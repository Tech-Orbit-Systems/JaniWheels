"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { passwordResetTokens, sessions, users } from "@/db/schema/users";
import { sendPasswordResetEmail } from "@/lib/email/password-reset";
import { hashPassword } from "./password";
import {
  createResetToken,
  hashResetToken,
  isPlausibleResetToken,
  resetExpiry,
} from "./reset";

export interface ForgotPasswordState {
  sent?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export interface ResetPasswordState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

const emailSchema = z.string().trim().email("Enter a valid email address.").max(254, "Email address is too long.");
const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(128, "Password is too long.");

function clientIp(h: Headers): string | null {
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0].trim() ??
    null
  );
}

function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return configured.replace(/\/$/, "");
}

export async function requestPasswordResetAction(
  _previous: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted field.",
      fieldErrors: { email: parsed.error.issues[0]?.message ?? "Enter a valid email." },
    };
  }

  const email = parsed.data.toLowerCase();
  const [account] = await db
    .select({ id: users.id, name: users.name, email: users.email, isBanned: users.isBanned })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // The response never reveals whether the address belongs to an account.
  if (account?.email && !account.isBanned) {
    const cooldown = new Date(Date.now() - 5 * 60_000);
    const [recent] = await db
      .select({ id: passwordResetTokens.id })
      .from(passwordResetTokens)
      .where(and(eq(passwordResetTokens.userId, account.id), gt(passwordResetTokens.createdAt, cooldown)))
      .limit(1);

    if (!recent) {
      const { token, tokenHash } = createResetToken();
      const h = await headers();
      const [created] = await db
        .insert(passwordResetTokens)
        .values({
          userId: account.id,
          tokenHash,
          expiresAt: resetExpiry(),
          requestedIp: clientIp(h)?.slice(0, 100) ?? null,
        })
        .returning({ id: passwordResetTokens.id });

      try {
        await sendPasswordResetEmail({
          to: account.email,
          name: account.name,
          resetUrl: `${siteUrl()}/reset-password?token=${encodeURIComponent(token)}`,
          idempotencyKey: `password-reset-${created.id}`,
        });
      } catch (error) {
        console.error("Password reset delivery failed", error);
        await db
          .update(passwordResetTokens)
          .set({ usedAt: new Date() })
          .where(eq(passwordResetTokens.id, created.id));
      }
    }
  }

  return { sent: true };
}

export async function resetPasswordAction(
  _previous: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const parsed = passwordSchema.safeParse(password);

  if (!parsed.success || password !== confirmPassword) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: {
        ...(parsed.success ? {} : { password: parsed.error.issues[0]?.message ?? "Enter a valid password." }),
        ...(password === confirmPassword ? {} : { confirmPassword: "Passwords do not match." }),
      },
    };
  }
  if (!isPlausibleResetToken(token)) {
    return { error: "This reset link is invalid or has expired." };
  }

  const tokenHash = hashResetToken(token);
  const passwordHash = await hashPassword(parsed.data);
  const changed = await db.transaction(async (tx) => {
    const [consumed] = await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date()),
      ))
      .returning({ userId: passwordResetTokens.userId });
    if (!consumed) return false;

    await tx
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, consumed.userId));
    await tx.delete(sessions).where(eq(sessions.userId, consumed.userId));
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResetTokens.userId, consumed.userId), isNull(passwordResetTokens.usedAt)));
    return true;
  });

  if (!changed) return { error: "This reset link is invalid or has expired." };
  redirect("/login?reset=success");
}

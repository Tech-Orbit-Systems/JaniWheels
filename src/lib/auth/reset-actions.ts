"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { passwordResetTokens, sessions, users } from "@/db/schema/users";
import { sendPasswordResetEmail } from "@/lib/email/password-reset";
import { logSafeError } from "@/lib/operations/safe-error";
import { hashPassword } from "./password";
import { allowAuthAttempt, AUTH_LIMITS, clientIp } from "@/lib/security/rate-limit";
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
  if (!await allowAuthAttempt("password-reset-request", email, await headers(), AUTH_LIMITS.emailRequest)) {
    return { sent: true };
  }
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
        logSafeError("auth.reset_delivery_failed", error);
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
  if (!await allowAuthAttempt("password-reset-confirm", tokenHash, await headers(), AUTH_LIMITS.tokenAction)) {
    return { error: "Too many attempts. Please try again in 15 minutes." };
  }
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

"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { emailVerificationTokens, users } from "@/db/schema/users";
import {
  issueEmailVerification,
} from "./email-verification";
import {
  hashEmailVerificationToken,
  isPlausibleEmailVerificationToken,
} from "./verification-token";
import { createSession } from "./session";
import { allowAuthAttempt, AUTH_LIMITS, clientIp } from "@/lib/security/rate-limit";

export interface VerifyEmailState {
  error?: string;
}

export interface ResendVerificationState {
  sent?: boolean;
  error?: string;
  fieldErrors?: { email?: string };
}

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "/";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function confirmEmailVerificationAction(
  _previous: VerifyEmailState,
  formData: FormData,
): Promise<VerifyEmailState> {
  const token = String(formData.get("token") ?? "");
  const next = safeNext(formData.get("next"));
  if (!isPlausibleEmailVerificationToken(token)) {
    return { error: "This verification link is invalid or has expired." };
  }
  if (!await allowAuthAttempt("email-verification-confirm", hashEmailVerificationToken(token), await headers(), AUTH_LIMITS.tokenAction)) {
    return { error: "Too many attempts. Please try again in 15 minutes." };
  }

  const account = await db.transaction(async (tx) => {
    const [consumed] = await tx
      .update(emailVerificationTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(
            emailVerificationTokens.tokenHash,
            hashEmailVerificationToken(token),
          ),
          isNull(emailVerificationTokens.usedAt),
          gt(emailVerificationTokens.expiresAt, new Date()),
        ),
      )
      .returning({
        userId: emailVerificationTokens.userId,
        email: emailVerificationTokens.email,
      });
    if (!consumed) return null;

    const [user] = await tx
      .select({ id: users.id, email: users.email, isBanned: users.isBanned })
      .from(users)
      .where(eq(users.id, consumed.userId))
      .limit(1);
    if (!user || user.isBanned || user.email !== consumed.email) return null;

    await tx
      .update(users)
      .set({ emailVerifiedAt: new Date(), lastSeenAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, user.id));
    await tx
      .update(emailVerificationTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(emailVerificationTokens.userId, user.id),
          isNull(emailVerificationTokens.usedAt),
        ),
      );
    return user;
  });

  if (!account) {
    return { error: "This verification link is invalid or has expired." };
  }
  const h = await headers();
  await createSession(account.id, {
    userAgent: h.get("user-agent") ?? undefined,
    ip: clientIp(h) ?? undefined,
  });
  redirect(next);
}

export async function resendEmailVerificationAction(
  _previous: ResendVerificationState,
  formData: FormData,
): Promise<ResendVerificationState> {
  const parsed = z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .max(254, "Email address is too long.")
    .safeParse(formData.get("email"));
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted field.",
      fieldErrors: { email: parsed.error.issues[0]?.message },
    };
  }

  const email = parsed.data.toLowerCase();
  if (!await allowAuthAttempt("verification-resend", email, await headers(), AUTH_LIMITS.emailRequest)) {
    return { sent: true };
  }
  const [account] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      emailVerifiedAt: users.emailVerifiedAt,
      isBanned: users.isBanned,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (account && !account.emailVerifiedAt && !account.isBanned && account.email) {
    const [recent] = await db
      .select({ id: emailVerificationTokens.id })
      .from(emailVerificationTokens)
      .where(
        and(
          eq(emailVerificationTokens.userId, account.id),
          isNull(emailVerificationTokens.usedAt),
          gt(emailVerificationTokens.createdAt, new Date(Date.now() - 5 * 60_000)),
        ),
      )
      .limit(1);
    if (!recent) {
      const h = await headers();
      try {
        await issueEmailVerification({
          userId: account.id,
          email: account.email,
          name: account.name,
          requestedIp: clientIp(h) ?? undefined,
        });
      } catch (error) {
        console.error("Email verification delivery failed", error);
      }
    }
  }

  // The response does not disclose whether the account exists.
  return { sent: true };
}

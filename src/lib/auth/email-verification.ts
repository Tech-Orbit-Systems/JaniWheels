import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { emailVerificationTokens } from "@/db/schema/users";
import { sendAccountVerificationEmail } from "@/lib/email/account-verification";
import { safeReturnPath } from "./return-path";
import {
  createEmailVerificationToken,
  emailVerificationExpiry,
} from "./verification-token";

function safeNext(value?: string): string {
  return safeReturnPath(value);
}

export async function issueEmailVerification(input: {
  userId: number;
  email: string;
  name: string | null;
  requestedIp?: string;
  next?: string;
}): Promise<void> {
  const { token, tokenHash } = createEmailVerificationToken();
  const [created] = await db.transaction(async (tx) => {
    await tx
      .update(emailVerificationTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(emailVerificationTokens.userId, input.userId),
          isNull(emailVerificationTokens.usedAt),
        ),
      );
    return tx
      .insert(emailVerificationTokens)
      .values({
        userId: input.userId,
        email: input.email,
        tokenHash,
        expiresAt: emailVerificationExpiry(),
        requestedIp: input.requestedIp?.slice(0, 100) ?? null,
      })
      .returning({ id: emailVerificationTokens.id });
  });

  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  const next = safeNext(input.next);
  try {
    await sendAccountVerificationEmail({
      to: input.email,
      name: input.name,
      verificationUrl: `${origin}/verify-email?token=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}`,
      idempotencyKey: `email-verification-${created.id}`,
    });
  } catch (error) {
    await db
      .update(emailVerificationTokens)
      .set({ usedAt: new Date() })
      .where(eq(emailVerificationTokens.id, created.id));
    throw error;
  }
}

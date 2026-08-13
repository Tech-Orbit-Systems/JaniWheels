import "server-only";
import { createHash, randomInt } from "node:crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { otpCodes, users } from "@/db/schema/users";
import { sendSms } from "./sms";
import { safeEqual } from "./session";

/**
 * Phone OTP.
 *
 * Identity in this market is the phone number. It is also the lead channel,
 * which means verifying it is not just a login step — an unverified number
 * is a listing nobody can act on.
 *
 * Three abuse surfaces, all handled here:
 *   - SMS pumping (someone burns your SMS budget)     -> per-phone rate limit
 *   - Code brute force (10k possibilities)            -> attempt cap
 *   - Code reuse                                      -> single-use consumption
 */

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_PER_HOUR = 5;

function hashCode(phone: string, code: string): string {
  // Salted with the phone number so identical codes for different numbers
  // do not produce identical hashes.
  return createHash("sha256").update(`${phone}:${code}`).digest("hex");
}

export type RequestResult =
  | { ok: true; devCode?: string }
  | { ok: false; error: string; retryAfterSec?: number };

export async function requestOtp(
  phone: string,
  ip?: string,
): Promise<RequestResult> {
  const [recent] = await db
    .select({ createdAt: otpCodes.createdAt })
    .from(otpCodes)
    .where(eq(otpCodes.phone, phone))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);

  if (recent) {
    const elapsed = Date.now() - recent.createdAt.getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      return {
        ok: false,
        error: "Please wait before requesting another code.",
        retryAfterSec: Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000),
      };
    }
  }

  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.phone, phone),
        gt(otpCodes.createdAt, new Date(Date.now() - 3_600_000)),
      ),
    );

  if (count >= MAX_PER_HOUR) {
    return {
      ok: false,
      error: "Too many codes requested. Try again in an hour.",
    };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");

  await db.insert(otpCodes).values({
    phone,
    codeHash: hashCode(phone, code),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
    requestIp: ip ?? null,
  });

  await sendSms(phone, `Your JaniWheels code is ${code}. Valid for 10 minutes.`);

  // In development the console provider prints the code; returning it too
  // keeps the login form usable without an SMS gateway configured.
  return {
    ok: true,
    devCode: process.env.OTP_PROVIDER === "console" ? code : undefined,
  };
}

export type VerifyResult =
  | { ok: true; userId: number; isNewUser: boolean }
  | { ok: false; error: string };

export async function verifyOtp(
  phone: string,
  code: string,
): Promise<VerifyResult> {
  const [row] = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.phone, phone),
        isNull(otpCodes.consumedAt),
        gt(otpCodes.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);

  if (!row) {
    return { ok: false, error: "That code has expired. Request a new one." };
  }

  if (row.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: "Too many incorrect attempts. Request a new code." };
  }

  if (!safeEqual(row.codeHash, hashCode(phone, code))) {
    await db
      .update(otpCodes)
      .set({ attempts: row.attempts + 1 })
      .where(eq(otpCodes.id, row.id));
    return { ok: false, error: "Incorrect code." };
  }

  await db
    .update(otpCodes)
    .set({ consumedAt: new Date() })
    .where(eq(otpCodes.id, row.id));

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1);

  if (existing) {
    await db
      .update(users)
      .set({ phoneVerifiedAt: new Date(), lastSeenAt: new Date() })
      .where(eq(users.id, existing.id));
    return { ok: true, userId: existing.id, isNewUser: false };
  }

  const [created] = await db
    .insert(users)
    .values({
      phone,
      phoneVerifiedAt: new Date(),
      lastSeenAt: new Date(),
    })
    .returning({ id: users.id });

  return { ok: true, userId: created.id, isNewUser: true };
}

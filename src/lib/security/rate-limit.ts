import "server-only";
import { createHmac } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimitBuckets } from "@/db/schema/security";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const AUTH_LIMITS = {
  signIn: { max: 10, windowMs: 15 * MINUTE },
  signInSource: { max: 300, windowMs: 15 * MINUTE },
  register: { max: 5, windowMs: 60 * MINUTE },
  emailRequest: { max: 5, windowMs: 60 * MINUTE },
  tokenAction: { max: 20, windowMs: 15 * MINUTE },
} as const;

export const ACCOUNT_LIMITS = {
  profile: { max: 30, windowMs: HOUR },
  password: { max: 10, windowMs: HOUR },
  avatar: { max: 10, windowMs: DAY },
  dealerRegistration: { max: 5, windowMs: DAY },
  dealerProfile: { max: 30, windowMs: HOUR },
  dealerLogo: { max: 10, windowMs: DAY },
  listingWrite: { max: 120, windowMs: HOUR },
  adminWrite: { max: 300, windowMs: HOUR },
} as const;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required for rate limiting");
  }
  return value ?? "local-development-rate-limit-only";
}

function bucketKey(scope: string, subject: string, period: number): string {
  return createHmac("sha256", secret())
    .update(`${scope}\0${subject}\0${period}`)
    .digest("hex");
}

/** Only configured reverse proxies may supply these headers in production. */
export function clientIp(headers: Headers): string | null {
  const raw = headers.get("cf-connecting-ip")
    ?? headers.get("x-real-ip")
    ?? headers.get("x-forwarded-for")?.split(",")[0];
  const ip = raw?.trim();
  return ip && ip.length <= 45 ? ip : null;
}

export async function consumeRateLimit({
  scope,
  subject,
  max,
  windowMs,
}: {
  scope: string;
  subject: string;
  max: number;
  windowMs: number;
}): Promise<boolean> {
  const now = Date.now();
  const period = Math.floor(now / windowMs);
  const key = bucketKey(scope, subject, period);
  const [row] = await db.insert(rateLimitBuckets)
    .values({ key, hits: 1, expiresAt: new Date((period + 1) * windowMs) })
    .onConflictDoUpdate({
      target: rateLimitBuckets.key,
      set: { hits: sql`${rateLimitBuckets.hits} + 1` },
    })
    .returning({ hits: rateLimitBuckets.hits });
  return row.hits <= max;
}

export async function clearRateLimit(scope: string, subject: string, windowMs: number): Promise<void> {
  const key = bucketKey(scope, subject, Math.floor(Date.now() / windowMs));
  await db.delete(rateLimitBuckets).where(eq(rateLimitBuckets.key, key));
}

export async function allowAuthAttempt(
  scope: string,
  identity: string,
  headers: Headers,
  limit: { max: number; windowMs: number },
): Promise<boolean> {
  const ip = clientIp(headers);
  // Both counters are checked. A distributed attack against one account and
  // account cycling from one source therefore share the same protection.
  const identityAllowed = await consumeRateLimit({ scope, subject: `identity:${identity}`, ...limit });
  if (!ip) return identityAllowed;
  const sourceAllowed = await consumeRateLimit({
    scope: `${scope}:source`, subject: `ip:${ip}`,
    max: scope === "sign-in" ? AUTH_LIMITS.signInSource.max : limit.max * 10,
    windowMs: limit.windowMs,
  });
  return identityAllowed && sourceAllowed;
}

export async function allowPublicAction(
  scope: string,
  identity: string,
  headers: Headers,
  limit: { max: number; sourceMax: number; windowMs: number },
): Promise<boolean> {
  const identityAllowed = await consumeRateLimit({
    scope, subject: `identity:${identity}`, max: limit.max, windowMs: limit.windowMs,
  });
  const ip = clientIp(headers);
  if (!ip) return identityAllowed;
  const sourceAllowed = await consumeRateLimit({
    scope: `${scope}:source`, subject: `ip:${ip}`,
    max: limit.sourceMax, windowMs: limit.windowMs,
  });
  return identityAllowed && sourceAllowed;
}

export async function allowAccountAction(
  scope: string,
  accountId: number,
  limit: { max: number; windowMs: number },
): Promise<boolean> {
  return consumeRateLimit({ scope: `account:${scope}`, subject: `user:${accountId}`, ...limit });
}

import "server-only";

import { createHash, randomBytes } from "node:crypto";

const VERIFICATION_HOURS = 24;

export function createEmailVerificationToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashEmailVerificationToken(token) };
}

export function hashEmailVerificationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isPlausibleEmailVerificationToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function emailVerificationExpiry(now = Date.now()): Date {
  return new Date(now + VERIFICATION_HOURS * 60 * 60_000);
}

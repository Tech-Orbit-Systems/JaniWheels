import "server-only";

import { createHash, randomBytes } from "node:crypto";

export const RESET_TOKEN_MINUTES = 30;

export function createResetToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashResetToken(token) };
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function resetExpiry(now = Date.now()): Date {
  return new Date(now + RESET_TOKEN_MINUTES * 60_000);
}

export function isPlausibleResetToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

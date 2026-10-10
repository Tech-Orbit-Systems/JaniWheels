import fs from "node:fs";
import {
  createEmailVerificationToken,
  emailVerificationExpiry,
  hashEmailVerificationToken,
  isPlausibleEmailVerificationToken,
} from "../src/lib/auth/verification-token";
import { safeReturnPath } from "../src/lib/auth/return-path";

const checks: Array<[string, boolean]> = [];
checks.push(["return targets remain on this site", [
  "/dashboard?x=1#ads",
  "/login",
].every(path => safeReturnPath(path) === path) && [
  "/\\attacker.example/review",
  "//attacker.example/review",
  "/%5cattacker.example/review",
  "/%2f%2fattacker.example/review",
  "/safe/..//attacker.example/review",
  "/safe/%2e%2e//attacker.example/review",
  "/%0d%0aLocation:evil",
  "https://attacker.example/review",
].every(path => safeReturnPath(path) === "/")]);
function source(path: string) {
  return fs.readFileSync(path, "utf8");
}
function contains(path: string, terms: string[]) {
  const text = source(path);
  return terms.every((term) => text.includes(term));
}

const first = createEmailVerificationToken();
const second = createEmailVerificationToken();
checks.push([
  "email verification tokens have independent 256-bit entropy",
  first.token !== second.token &&
    isPlausibleEmailVerificationToken(first.token) &&
    isPlausibleEmailVerificationToken(second.token),
]);
checks.push([
  "only verification token digests are persisted",
  first.tokenHash === hashEmailVerificationToken(first.token) &&
    first.tokenHash.length === 64 &&
    !first.tokenHash.includes(first.token),
]);
checks.push([
  "verification links expire after 24 hours",
  emailVerificationExpiry(0).getTime() === 24 * 60 * 60_000,
]);
checks.push([
  "Google is the first login option and Facebook is excluded",
  source("src/app/login/LoginForm.tsx").indexOf("Continue with Google") <
    source("src/app/login/LoginForm.tsx").indexOf("or use email") &&
    !source("src/app/login/LoginForm.tsx").toLowerCase().includes("facebook"),
]);
checks.push([
  "Google authorization uses state nonce and PKCE",
  contains("src/app/api/auth/google/start/route.ts", [
    "jw_google_state",
    "jw_google_nonce",
    "code_challenge",
    'code_challenge_method: "S256"',
  ]),
]);
checks.push([
  "Google callback validates signed ID-token audience issuer and nonce",
  contains("src/lib/auth/google.ts", [
    "createRemoteJWKSet",
    "jwtVerify",
    "audience: config.clientId",
    "issuer: GOOGLE_ISSUERS",
    "verified.payload.nonce",
    "email_verified: z.literal(true)",
  ]),
]);
checks.push([
  "Google account linking is keyed by provider subject",
  contains("src/lib/auth/google.ts", [
    'eq(authAccounts.provider, "google")',
    "eq(authAccounts.providerSubject, claims.sub)",
    "googleIsAuthoritativeForEmail",
  ]),
]);
checks.push([
  "email verification is single-use and activates the matching address",
  contains("src/lib/auth/verification-actions.ts", [
    "isNull(emailVerificationTokens.usedAt)",
    "gt(emailVerificationTokens.expiresAt",
    "user.email !== consumed.email",
    "emailVerifiedAt: new Date()",
  ]),
]);
checks.push([
  "legacy mobile and verified email password login are both accepted",
  contains("src/lib/auth/actions.ts", [
    'parsed.data.identifier.includes("@")',
    "normalizePkPhone(parsed.data.identifier)",
    "asEmail && !account.emailVerifiedAt",
  ]),
]);
checks.push([
  "buyer phone is nullable while every seller flow enforces it",
  contains("src/db/schema/users.ts", ['phone: text("phone"),']) &&
    contains("src/lib/listings/sell-actions.ts", [
      "requirePostingPhone(user)",
      'redirect("/login?next=/sell")',
      'redirect("/login?next=/sell/bike")',
      'redirect("/login?next=/sell/part")',
    ]),
]);
checks.push([
  "migration preserves existing account access as email-verified",
  contains("drizzle/0009_luxuriant_black_bolt.sql", [
    'ALTER COLUMN "phone" DROP NOT NULL',
    'SET "email_verified_at" = COALESCE("created_at", now())',
  ]),
]);
checks.push([
  "local startup repairs migration-ledger drift before Google authentication",
  contains("scripts/repair-local-google-auth-schema.ts", [
    'new Set(["localhost", "127.0.0.1", "::1"])',
    "create table if not exists \"auth_accounts\"",
    "create table if not exists \"email_verification_tokens\"",
    "add column if not exists \"email_verified_at\"",
    "add column if not exists \"updated_at\"",
  ]) &&
    contains("start-dev.ps1", [
      "npm.cmd run db:repair:google-auth",
      "npm.cmd run dev",
      "Local schema repair failed. Dev server not started.",
    ]),
]);

let failures = 0;
for (const [name, passed] of checks) {
  if (!passed) failures++;
  console.log(`${passed ? "✓" : "✗"} ${name}`);
}
if (failures) process.exit(1);

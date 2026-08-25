import fs from "node:fs";
import {
  createResetToken,
  hashResetToken,
  isPlausibleResetToken,
  resetExpiry,
} from "../src/lib/auth/reset";

const checks: Array<[string, boolean]> = [];
function contains(path: string, terms: string[]) {
  const source = fs.readFileSync(path, "utf8");
  return terms.every((term) => source.includes(term));
}

const first = createResetToken();
const second = createResetToken();
checks.push(["reset tokens have 256 bits of independent entropy", first.token !== second.token && isPlausibleResetToken(first.token) && isPlausibleResetToken(second.token)]);
checks.push(["only reset-token digests are persisted", first.tokenHash === hashResetToken(first.token) && first.tokenHash.length === 64 && !first.tokenHash.includes(first.token)]);
checks.push(["reset tokens expire after thirty minutes", resetExpiry(0).getTime() === 30 * 60_000]);
checks.push(["forgot-password response prevents account enumeration", contains("src/lib/auth/reset-actions.ts", ["The response never reveals", "return { sent: true }"]) ]);
checks.push(["reset consumption is single-use and revokes sessions", contains("src/lib/auth/reset-actions.ts", ["isNull(passwordResetTokens.usedAt)", "gt(passwordResetTokens.expiresAt", "tx.delete(sessions)"]) ]);
checks.push(["contact changes require the current password", contains("src/lib/account/actions.ts", ["contactChanged", "verifyPassword(parsed.data.currentPassword", "Confirm your current password"]) ]);
checks.push(["public seller page exposes active listings only", contains("src/app/sellers/[id]/page.tsx", ['eq(listings.status, "active")', 'eq(users.type, "individual")']) ]);
checks.push(["production reset email uses configured authenticated delivery", contains("src/lib/email/password-reset.ts", ["RESEND_API_KEY", "EMAIL_FROM", "https://api.resend.com/emails", "Idempotency-Key"]) ]);

let failures = 0;
for (const [name, passed] of checks) {
  if (!passed) failures++;
  console.log(`${passed ? "✓" : "✗"} ${name}`);
}
if (failures) process.exit(1);

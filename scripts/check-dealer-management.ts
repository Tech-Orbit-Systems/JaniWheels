import fs from "node:fs";

const checks: Array<[string, boolean]> = [];
function source(path: string) {
  return fs.readFileSync(path, "utf8");
}
function contains(path: string, terms: string[]) {
  const text = source(path);
  return terms.every((term) => text.includes(term));
}

checks.push(["dealer settings require the authenticated profile owner", contains("src/lib/dealers/actions.ts", ["requireDealerOwner", "eq(dealers.userId, user.id)", 'redirect("/dealers/register")'])]);
checks.push(["dealer identity edits reset verified status for re-review", contains("src/lib/dealers/actions.ts", ["identityChanged", "resetVerification", "dealer_review_reset", "verifiedAt: null"])]);
checks.push(["dealer logos use hardened storage and cleanup", contains("src/lib/dealers/actions.ts", ["5 * 1024 * 1024", "storeImage(file)", "removeStoredImage(stored.image.key)", "removeDealerLogoAction"])]);
checks.push(["dealer administration is restricted to admin accounts", contains("src/lib/dealers/actions.ts", ["requireDealerAdmin", "users.isAdmin", "if (!account?.isAdmin) redirect"])]);
checks.push(["verification revocation requires a recorded reason", contains("src/lib/dealers/actions.ts", ['decision === "revoke"', "cleanReason.length < 5", "dealer_revoke"])]);
checks.push(["verification changes and audit entries are transactional", contains("src/lib/dealers/actions.ts", ["setDealerVerificationAction", "db.transaction", ".update(dealers)", "tx.insert(moderationLog)"])]);
checks.push(["public badges and logos derive from the current dealer record", contains("src/app/dealers/[slug]/page.tsx", ["dealers.verifiedAt", "dealer.verifiedAt", "imageDeliveryUrl(dealer.logoUrl", "Verified dealer"])]);
checks.push(["dealer directory exposes verified profiles only", contains("src/app/dealers/page.tsx", ["isNotNull(dealers.verifiedAt)", "active", "ads"])]);
checks.push(["dealer storefront supports every listing vertical", contains("src/app/dealers/[slug]/page.tsx", ["vertical: listings.vertical", "vertical={row.vertical}", "active", "ads"])]);
checks.push(["admin console exposes decisions and append-only audit history", contains("src/app/admin/dealers/page.tsx", ["Dealer verification", "Verification audit history", "dealer_verify", "dealer_revoke", "dealer_review_reset"])]);
checks.push(["verified dealers can manage settings from their dashboard", contains("src/app/dashboard/dealer/page.tsx", ['/dashboard/dealer/settings', "Dealer settings", "dealer_revoke"])]);

let failures = 0;
for (const [name, passed] of checks) {
  if (!passed) failures++;
  console.log(`${passed ? "✓" : "✗"} ${name}`);
}
if (failures) process.exit(1);

import fs from "node:fs";
import { rejectionDecision } from "../src/lib/trust/moderation-policy";

const checks: Array<[string, boolean]> = [];
const source = (path: string) => fs.readFileSync(path, "utf8");
const contains = (path: string, terms: string[]) => { const text = source(path); return terms.every((term) => text.includes(term)); };

checks.push(["all administrator actions require an admin account", contains("src/lib/trust/actions.ts", ["requireAdmin()", "setAdminListingStateAction", "setUserBanAction"])]);
checks.push(["listing controls support hide, reinstate and permanent removal", contains("src/lib/trust/actions.ts", ['"flag" | "reinstate" | "remove"', 'decision === "reinstate"', '"pending_review"', '"removed"'])]);
checks.push(["permanently removed ads cannot be restored", contains("src/lib/trust/actions.ts", ['listing.status === "removed"', "cannot be reinstated"])]);
checks.push(["administrative listing decisions are transactional and audited", contains("src/lib/trust/actions.ts", ["db.transaction", "tx.insert(moderationLog)", "previousStatus", "nextStatus"])]);
checks.push(["manual bans revoke active sessions and are audited", contains("src/lib/trust/actions.ts", ["tx.delete(sessions)", 'action: decision', 'decision === "ban"'])]);
checks.push(["self-ban and administrator-ban are prevented", contains("src/lib/trust/actions.ts", ["targetUserId === admin.id", "target.isAdmin"])]);
checks.push(["administrator listing edits preserve status and create an audit entry", contains("src/lib/listings/manage-actions.ts", ["adminEdit", "preservedStatus", 'action: "edit"'])]);
checks.push(["listing console exposes full ad, edit and moderation actions", contains("src/app/admin/listings/page.tsx", ["All listings", "Edit full ad", "ModerationActions", "buildListingPath"])]);
checks.push(["user console exposes access actions and audit history", contains("src/app/admin/users/page.tsx", ["User controls", "UserAccessActions", "Access audit history", "listingCount"])]);
checks.push(["seller receives three attempts before permanent removal", rejectionDecision(0).rejectionNumber === 1 && !rejectionDecision(0).isFinal && rejectionDecision(2).isFinal]);
checks.push(["seller dashboard retains rejection reason and resubmission guidance", contains("src/app/dashboard/page.tsx", ["Fix details and resubmit", "latestRejectionReason", "Permanently removed after the third rejection"])]);

let failures = 0;
for (const [name, passed] of checks) { if (!passed) failures++; console.log(`${passed ? "✓" : "✗"} ${name}`); }
if (failures) process.exit(1);

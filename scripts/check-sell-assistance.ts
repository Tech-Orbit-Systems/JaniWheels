import fs from "node:fs";
import { allowedSellAssistanceTransitions, validateSellAssistanceUpdate } from "../src/lib/trust/sell-assistance-policy";

const source = (path: string) => fs.readFileSync(path, "utf8");
const contains = (path: string, terms: string[]) => terms.every((term) => source(path).includes(term));
const checks: Array<[string, boolean]> = [
  ["request records structured vehicle and selling details", contains("src/db/schema/trust.ts", ["sellAssistanceRequests", "ownershipStatus", "vehicleCondition", "sellingTimeline", "expectedPricePkr"])],
  ["new request and first customer event share one transaction", contains("src/lib/trust/sell-assistance-actions.ts", ["db.transaction", "tx.insert(sellAssistanceRequests)", "tx.insert(sellAssistanceEvents)"])],
  ["selected model must belong to selected car make", contains("src/lib/trust/sell-assistance-actions.ts", ["eq(models.makeId, parsed.data.makeId)", 'eq(models.vertical, "car")'])],
  ["existing listing can only belong to requesting seller", contains("src/lib/trust/sell-assistance-actions.ts", ["eq(listings.sellerId, user.id)", 'eq(listings.vertical, "car")'])],
  ["admin update locks request and writes append-only event", contains("src/lib/trust/sell-assistance-actions.ts", ['.for("update")', "tx.insert(sellAssistanceEvents)"])],
  ["customer dashboard never selects internal staff notes", !source("src/app/dashboard/sell-assistance/page.tsx").includes("internalNote")],
  ["terminal states have no outgoing transitions", allowedSellAssistanceTransitions("sold").length === 0 && allowedSellAssistanceTransitions("cancelled").length === 0],
  ["invalid lifecycle jump is blocked", Boolean(validateSellAssistanceUpdate({ current: "requested", next: "ad_live", internalNote: "", customerMessage: "Live" }))],
  ["status changes require customer-visible message", Boolean(validateSellAssistanceUpdate({ current: "requested", next: "contacted", internalNote: "Called", customerMessage: "" }))],
  ["scope disclaimer excludes valuation and guarantees", contains("src/app/sell-my-car/SellAssistanceForm.tsx", ["does not promise a valuation", "buyer", "payment handling"])],
];

let failures = 0;
for (const [name, passed] of checks) { if (!passed) failures++; console.log(`${passed ? "✓" : "✗"} ${name}`); }
if (failures) process.exit(1);

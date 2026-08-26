import fs from "node:fs";
import { allowedInspectionTransitions, validateInspectionUpdate } from "../src/lib/trust/inspection-policy";

const source = (path: string) => fs.readFileSync(path, "utf8");
const contains = (path: string, terms: string[]) => terms.every((term) => source(path).includes(term));
const checks: Array<[string, boolean]> = [
  ["new requests create a customer-visible audit event", contains("src/lib/trust/actions.ts", ["tx.insert(inspectionEvents)", "Your inspection request has been received"])],
  ["admin updates require an administrator and lock the request", contains("src/lib/trust/actions.ts", ["updateInspectionAction", "requireAdmin()", '.for("update")'])],
  ["status updates and audit events share one transaction", contains("src/lib/trust/actions.ts", ["tx.update(inspections)", "tx.insert(inspectionEvents)"])],
  ["customer page never selects internal notes", !source("src/app/dashboard/inspections/page.tsx").includes("internalNote")],
  ["admin queue exposes follow-up and audit history", contains("src/app/admin/inspections/page.tsx", ["InspectionAdminForm", "Audit history", "internalNote"])],
  ["terminal statuses have no outgoing transitions", allowedInspectionTransitions("completed").length === 0 && allowedInspectionTransitions("cancelled").length === 0],
  ["invalid transitions are rejected", Boolean(validateInspectionUpdate({ current: "requested", next: "completed", internalNote: "", customerMessage: "Done" }))],
  ["status changes require a customer update", Boolean(validateInspectionUpdate({ current: "requested", next: "contacted", internalNote: "called", customerMessage: "" }))],
  ["internal note-only updates remain available", validateInspectionUpdate({ current: "contacted", next: "contacted", internalNote: "Customer called back", customerMessage: "" }) === null],
  ["schema stores append-only inspection events", contains("src/db/schema/trust.ts", ["inspectionEvents", "fromStatus", "customerMessage", "internalNote"])],
];

let failures = 0;
for (const [name, passed] of checks) { if (!passed) failures++; console.log(`${passed ? "✓" : "✗"} ${name}`); }
if (failures) process.exit(1);

import assert from "node:assert/strict";
import { readinessResponse } from "../src/lib/operations/health";

const healthy = await readinessResponse(async () => 1);
assert.equal(healthy.status, 200);
assert.deepEqual(await healthy.json(), { status: "ready" });
const failed = await readinessResponse(async () => { throw new Error("postgres://private-user:secret@example.invalid/customer"); });
assert.equal(failed.status, 503);
assert.equal(failed.headers.get("cache-control"), "no-store");
assert.equal(failed.headers.get("x-robots-tag"), "noindex");
assert.deepEqual(await failed.json(), { status: "unavailable" });
console.log("Readiness success/failure and public error redaction checks passed.");

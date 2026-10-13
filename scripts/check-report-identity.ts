import assert from "node:assert/strict";
import { anonymousReportId } from "../src/lib/trust/report-identity";

const previousHeader = process.env.TRUSTED_PROXY_IP_HEADER;
const previousSecret = process.env.SESSION_SECRET;
try {
  process.env.SESSION_SECRET = "test-only-report-identity-secret-123456789";
  delete process.env.TRUSTED_PROXY_IP_HEADER;
  assert.equal(anonymousReportId(new Headers(), "local-cookie"), "local-cookie");
  process.env.TRUSTED_PROXY_IP_HEADER = "x-real-ip";
  const one = anonymousReportId(new Headers({ "x-real-ip": "203.0.113.40" }), "first-cookie");
  assert.ok(one?.startsWith("src:"));
  assert.equal(one, anonymousReportId(new Headers({ "x-real-ip": "203.0.113.40" }), "cleared-cookie"));
  assert.notEqual(one, anonymousReportId(new Headers({ "x-real-ip": "203.0.113.41" }), "first-cookie"));
  assert.equal(anonymousReportId(new Headers({ "x-forwarded-for": "203.0.113.40" }), "first-cookie"), null);
  assert.equal(anonymousReportId(new Headers({ "x-real-ip": "203.0.113.40, 203.0.113.41" }), "first-cookie"), null);
  console.log("Anonymous report identity resists cookie clearing with a trusted proxy source.");
} finally {
  if (previousHeader === undefined) delete process.env.TRUSTED_PROXY_IP_HEADER;
  else process.env.TRUSTED_PROXY_IP_HEADER = previousHeader;
  if (previousSecret === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = previousSecret;
}

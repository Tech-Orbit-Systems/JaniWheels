import assert from "node:assert/strict";
import { environmentIssues } from "../src/lib/env";

const base = { DATABASE_URL: "postgresql://test:test@localhost/test", SESSION_SECRET: "x".repeat(40), NEXT_PUBLIC_SITE_URL: "http://localhost:3000" };
assert.deepEqual(environmentIssues(base), []);
for (const invalid of [{ DATABASE_URL: "https://secret:password@example.com" }, { SESSION_SECRET: "short" }, { NEXT_PUBLIC_SITE_URL: "https://example.com/path?secret=key" }, { UPLOAD_DIR: "public/uploads" }, { IMAGE_PROVIDER: "s3" }, { GOOGLE_CLIENT_ID: "alone" }, { NEXT_PUBLIC_IMAGE_PROVIDER: "cloudflare" }]) {
  const issues = environmentIssues({ ...base, ...invalid });
  assert.ok(issues.length);
  assert.ok(!issues.join().includes("password"));
}
assert.ok(environmentIssues(base, true).some(issue => issue.includes("HTTPS")));
const live = { ...base, NEXT_PUBLIC_SITE_URL: "https://janiwheels.com", IMAGE_PROVIDER: "cloudflare", NEXT_PUBLIC_IMAGE_PROVIDER: "cloudflare", CF_IMAGES_ACCOUNT_ID: "id", CF_IMAGES_API_TOKEN: "token", NEXT_PUBLIC_CF_IMAGES_HASH: "hash", CF_IMAGES_SIGNING_KEY: "key", CF_IMAGES_PRIVATE_VARIANT: "private", GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret", RESEND_API_KEY: "key", EMAIL_FROM: "JaniWheels <hello@example.com>", CRON_SECRET: "z".repeat(40) };
assert.deepEqual(environmentIssues(live, true), []);
assert.ok(environmentIssues({ ...live, ACCEPTANCE_EMAIL_DIR: "/tmp/mail" }, true).length);
console.log("Runtime/launch environment validation and redaction checks passed.");

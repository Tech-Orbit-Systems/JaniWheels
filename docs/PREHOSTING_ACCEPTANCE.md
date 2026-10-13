# Prehosting acceptance record

Updated: 13 October 2026. Candidate branch: `codex/prelaunch-security-qa`.
This record covers the local application and its isolated acceptance database.
The master tracker remains the source of feature and test-case status.

## Verified locally

| Gate | Result |
| --- | --- |
| `npm run check` and `npm run lint` | Passed; includes type, environment, SEO, ownership, upload and report-identity checks. |
| Fresh migrations, curated seed and database acceptance | 22/22 passed. |
| Production build | Passed; maximum First Load JS 128 KB, below the 150 KB budget. |
| Route sweep | 101 URLs, zero issues on the fresh database. |
| Browser acceptance | 179 passed, one planned skip; desktop/mobile Chromium, three local iPhone WebKit smokes and recovery cases. |
| Local HTTP read smoke | 100 requests at concurrency five; zero failures, p50 250 ms, p95 585 ms, maximum 811 ms. See `LOCAL_LOAD_SMOKE.md`. |
| Browse query plans | 20,000 synthetic listings plus demo inventory; fixtures rolled back. See `LOCAL_QUERY_PLAN_REPORT.md`. |
| Production dependency audit | `npm audit --omit=dev --audit-level=low`: zero reported vulnerabilities. |
| Development dependency audit | Ten advisories remain: four moderate and six high in build/lint tooling. They are outside the production dependency tree and need a separate compatible-tooling update. |

The browser suite now includes direct malformed registration and report payloads,
six-photo uploads in bounded batches, invalid bulk uploads, the real-tap WebKit
default-motion navigation path, and forced reciprocal report schedules. Upload
checks also cover disguised SVG, oversized images, trailing script bytes and a
streamed multipart request without `Content-Length`.

## Application security changes

- Only the explicitly configured, proxy-overwritten IP header can identify a
  source for rate limits and anonymous reports. The app rejects malformed IPs
  and comma-separated chains. The launch environment check requires this setting.
- Clearing the local anonymous cookie no longer creates a new reporting identity
  when the trusted proxy source is configured. The identifier stored for a
  report is an HMAC, not a raw IP. Shared public IPs share one anonymous report
  per ad; this needs a policy review if it becomes a support issue.
- Upload requests are capped at five files and 52 MiB in the app even without
  `Content-Length`. The seller/edit forms send larger selections in batches.
- Restore ledger receipt and export times use the same database clock. Replay
  rejects a ledger generated in that database's future.
- Existing authorization, origin, rate-limit, moderation, retention and private
  media regressions passed in the full local suite.

No security review can guarantee that the site has no exploitable defect. The
production Content Security Policy still allows inline scripts for Next.js;
nonce-based hardening is a separate compatibility and performance change. The
local pass and dependency audit do not replace an independent review of this
candidate or an assessment of the deployed proxy, storage, logs and secrets.

## Evidence still required before launch

1. Independent review and green CI on the exact candidate commit, followed by
   a separate merge decision.
2. Hosting with HTTPS, an isolated staging database, durable Cloudflare Images,
   verified email and Google credentials, secrets, blocked direct Node access,
   a proxy-overwritten source IP header, upload body/concurrency limits and
   request timeouts. Verify header spoof rejection on that actual path.
3. Live private-image lifecycle, email inbox and retries, OAuth, scheduled jobs,
   administrator bootstrap, monitoring, backup and deletion-ledger restore
   rehearsal. Run the handoff and regression checklists on the deployed SHA.
4. Real Android Chrome and iPhone Safari journeys, camera/gallery, keyboard,
   zoom, screen reader and slow-network checks on HTTPS.
5. Representative Core Web Vitals and the required 500-user ramp/soak with the
   selected host, production-like data/media and monitoring. The local read
   smoke and query plans do not certify that capacity.

Keep these gates open in the tracker until the deployment team returns direct
evidence. Do not treat this local record as production launch approval.

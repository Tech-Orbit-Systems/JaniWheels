# PR #6 review record

Reviewed 3 October 2026 against main `c1ef18d`, application head `0569081`.
This is an agent self-review, not an independent security audit or GitHub
maintainer approval. Main-branch merge remains a separate decision.

## Outcome

No additional blocking regression was identified in the reviewed changes.
The prior review finding, numeric email retry keys overlapping between
environments, was fixed in `0569081` using persisted UUID keys. Its regression
test checks retry key and payload stability; concurrent delivery is also covered.

## Areas reviewed

- Authentication/account/dealer action changes and their server-side limits;
  direct-action authorization acceptance for seller and administrator workflows.
- Listing validation and curated taxonomy boundary, report serialization,
  inspection references and customer/private administration separation.
- Private media key validation, upload ownership, visibility, optimizer bypass
  prevention, Cloudflare signing, provider response limits and cleanup.
- Saved-search matching, overflow, deduplication, committed delivery leases,
  retry identity, opt-out/eligibility suppression and retry-window expiry.
- Dealer pagination and banned-owner visibility; browse recovery, UI labels,
  contrast, enlarged-text layout and reduced-motion changes.
- JSON-LD escaping, browse canonical redirect placement, database migrations,
  environment checks, first-admin bootstrap, readiness and error-event fields.

## Verified evidence

[GitHub run 43](https://github.com/Tech-Orbit-Systems/JaniWheels/actions/runs/37111510845)
completed successfully for `0569081720512ef21133a3df37751762950fc8b0`.
The job confirms success for production dependency audit, fresh migrations,
seeding, DB acceptance, static checks, lint, production build, route sweep and
browser acceptance. Run 42 also passed the preceding implementation package.
The review closeout commit changes documentation and the workbook only.

## Approved retention package review — 5 October 2026

Decision A implementation now includes restricted 30-day recovery, public hiding,
session revocation, bounded calendar retention, early deletion, accountable holds,
anonymous monthly usage totals, retryable media deletion and restore ledger replay.
Reviewed authorization, publication/session races, moderator-change preservation,
calendar boundaries, hold propagation, transactional redaction/queue persistence,
provider retries and cross-database/idempotent restore protections. Browser
acceptance exposed a raw SQL/Drizzle codec conflict; separate small native-codec
pool fixes it. Check/lint/build, 9 DB tests, 4 desktop/mobile retention cases and
101-route sweep pass locally. Full regression CI on the current commit must pass.
Normal local schema is updated; no production customer cleanup was executed.

## Remaining launch gates

| Gate | Required input/access | Work after access is available |
| --- | --- | --- |
| HTTPS staging, hosting and PostgreSQL | Selected host and deployment access | Configure, migrate, deploy, smoke test and rehearse rollback |
| Cloudflare private images | Account/token/signing key and private variant | Live upload/read/delete, old custom-ID migration and bandwidth acceptance |
| Alert delivery | Resend key and verified sender | Scheduler setup, backlog review, mailbox and provider-failure acceptance |
| OAuth and Maps | Live domain/provider setup and Maps billing | HTTPS login and map acceptance |
| Operations | Hosting/provider administration | Backups and restore drill, monitoring, cron and trusted proxy/request-size configuration |
| Retention operations | Production scheduler, storage and backup administration | Deploy the approved cleanup policy, verify provider deletion and rehearse restore |
| Release acceptance | HTTPS staging and physical devices/reviewer | Real-device, screen-reader and production-like load testing |
| Main merge | Maintainer merge decision and repository checks | Merge reviewed branch after required gates |

Local and mock-provider acceptance does not prove these live gates. Existing
load measurements are a bounded local smoke, not the 500-user production target.
Owner approved B1 on 4 October 2026: no ordinary-seller verification badge in
V1; existing manual dealer verification continues. JW-053 is removed from scope.
The master tracker retains live gaps; its estimate is now 93.09% after this
approved scope removal. Retention decision A was approved exactly as proposed on 4 October 2026. The implementation and current verification are described in docs/RETENTION_DECISIONS.md.

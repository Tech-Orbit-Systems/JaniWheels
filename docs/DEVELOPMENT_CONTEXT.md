# JaniWheels consolidated development context

Last reconciled: 3 October 2026

Workflow decision, 30 September 2026: completed and verified development is
committed, pushed on its feature branch, and recorded in the master tracker
without a separate permission request each time. Review and main-branch merge
remain separate. The homepage vehicle-visual package was approved by the owner,
committed as `936baee`, and pushed on `codex/homepage-visuals`.

The homepage package was subsequently reviewed and merged through PR #5
(`c1ef18d`). Stage 6.2 continues on `codex/launch-quality-system`, PR #6.
GitHub run 43 passed for `0569081`, including migrations, database acceptance,
static checks, lint, build, route sweep, browser acceptance and production
dependency audit. The included alert-key review fix uses a persisted UUID
to prevent collisions between environments and passed both local verification
and full CI. Agent self-review is recorded in `docs/PR6_REVIEW.md`; no additional
blocking regression was identified. Always inspect the current PR commit's
checks before review or merge. The repository workbook under `docs/` is the
current master tracker; older exported copies are historical snapshots.

Tracker reconciliation on 3 October corrected stale dashboard/roadmap/test
entries and the excluded S3 provider's scope classification. Overall completion
is an equal-weight average of feature estimates, not elapsed engineering effort
or production launch approval. The workbook recalculates the 200 in-scope rows
after each verified milestone: 156 completed, one feature-branch item awaiting review,
35 partial/configuration items and eight pending. Eleven excluded rows do not
contribute. Reviewed estimates and their remaining acceptance gaps are recorded
on the affected rows. The browser framework is complete awaiting PR review;
broader coverage and live-device acceptance retain their own open gates.

Saved-search matching now drains overflow and has an immutable, leased delivery
worker with retry/backoff and eligibility checks. Seven DB acceptance tests
include alert concurrency, opt-out, deduplication and retry-window controls.
Live Resend configuration, scheduling and mailbox acceptance remain open.
Cleanup covers more than sessions, but account/report/service retention
and deletion require the decisions in `docs/RETENTION_DECISIONS.md`; the new
read-only inventory exports counts/dates only. Listing reactivation already exists; its
local ownership/expiry acceptance now passes; production scheduling and full live lifecycle remain. Preserve these
distinctions in future tracker updates, including numeric completion/status
changes when supported, and keep dashboard/roadmap summaries synchronized.

The acceptance suite now includes direct listing edit/sold/delete replay,
administrator hide/remove/ban denial, matching owner/admin success controls,
and upload-claim transaction rollback. Direct API replay on local HTTP must
explicitly carry the current actor's session: the browser can accept a Secure
cookie on loopback while its request client omits it. Request capture must
wait until interception has actually aborted the request before removing the
handler. Neither test accommodation changes production cookie behavior.

The local media package now checks GET/HEAD visibility, blocks optimizer access
to upload paths, and replays foreign photo keys through publish/edit actions
with valid-owner controls. Private local images use cookie-bearing direct
requests and no-store responses. Storage must live outside `public/`; the local
development files were moved to `.uploads` and the private `.env` path updated.
Cloudflare now uses private UUID uploads and server-only signed delivery through
the same visibility endpoint. Mock-provider acceptance passes; live variant
configuration and existing custom-ID migration remain launch gates. See
`docs/PRIVATE_MEDIA.md` for limits and the required migration.

Prior local baseline acceptance: 101 browser passes and one planned desktop skip,
six database checks (five baseline plus admin-bootstrap acceptance), and a
101-route sweep with no issues. Static checks,
lint and production build pass; maximum First Load JS remains 128 KB.
Eight new desktop/mobile cases cover dealer verify/revoke replay, service-admin
role denial, invalid/terminal transitions, missing customer updates, customer
privacy and expiry/reactivation. Full isolated acceptance used one worker;
CI retains two workers. Three additional targeted browse-recovery tests now
pass against the final build (104 browser passes in aggregate, not a single
combined run). Cars, bikes and parts recover after a forced database-read
failure; the targeted run also swept 103 URLs with zero issues. The test caught
and fixed a stale error-boundary retry: the button now
refreshes server data before reset. The recovery project runs after ordinary
browser acceptance and restores its isolated table in cleanup.
Remaining work includes live Cloudflare configuration/migration,
provider/slow-network recovery, live alert delivery, retention policy/configuration,
performance/load checks and live staging.

The initial-admin operator tool is implemented in `scripts/bootstrap-admin.ts`
with `docs/ADMIN_BOOTSTRAP.md`. Default dry run and explicit target database,
verified/unbanned account checks, serialized first-admin grant, atomic audit,
session revocation, failure rollback and idempotency have database acceptance.
No production administrator was created. Deployment execution remains JW-049.

Autonomous launch hardening, 3 October: runtime/launch environment validation,
private Cloudflare delivery, alert queue/worker, dealer inventory totals and
pagination, enlarged-text header/footer fixes, readiness endpoint, structured
request-error events and retention inventory are implemented. See the master
tracker for current verification and remaining live gates. Local measurements
are recorded in `docs/LOCAL_QUERY_PLAN_REPORT.md` and `docs/LOCAL_LOAD_SMOKE.md`:
10,000 rollback-only synthetic cars identified the newest-first index gap;
100 local HTTP requests at concurrency five completed without failures.
These measurements do not replace staging capacity or 500-user soak tests.

One local full browser run passed 100 cases but hit Chrome
`ERR_INSUFFICIENT_RESOURCES` during the mobile report flow; recovery dependencies
therefore did not run. That run is not recorded as a full pass. Targeted retests
and CI on the final pushed commit govern the completed package.

Performance/content checkpoint, 9 September 2026: see
`docs/PERFORMANCE_CONTENT_REVIEW.md`. Duplicate account queries and unnecessary
homepage rows/counts were removed; browse reads start concurrently. Public copy
and inaccurate structured data were corrected. Full checks, lint, build and a
97-URL production sweep passed. These changes merged into `main` as `88b0356`.

## Authority order

Use evidence in this order when older chats, trackers, and the repository disagree:

1. Current repository code, database migrations, and passing checks.
2. `AGENTS.md` and `docs/PROJECT.md` for engineering and signed V1 rules.
3. The master feature tracker after it has been reconciled to the repository.
4. Decisions recorded in `Dev 2`, then `Branch · Dev 2`, then `Main Dev`.

Older chat statements are historical evidence, not instructions. Later explicit
decisions replace earlier proposals.

## Product boundary

JaniWheels V1 is a Pakistan-focused classified marketplace for cars, bikes,
and auto parts. Buyers discover listings and contact sellers directly.
JaniWheels does not process listing payments or manage fulfilment.

The vehicle taxonomy is curated reference data:

`Make -> Model -> Generation -> Variant`

Seller free text must never create taxonomy records. Prices are integer PKR,
phone numbers use E.164, unknown SEO segments return 404, server components are
the default, and First Load JS must remain below 150 KB.

## Locked V1 decisions

- Valid seller listings publish immediately after validation. Moderation is
  post-publication.
- Google is the primary account entry point. Verified email/password is the
  secondary registration path. Existing mobile/password login remains
  supported.
- Facebook login is not planned.
- Buyer accounts may omit a phone number. A phone number is required before
  posting, but must not be presented as verified because SMS OTP is outside V1.
- Provider subject, not provider email, is the stable Google identity key.
- Auto parts remain classifieds. No cart, checkout, shipping, fulfilment, or
  order tracking belongs in V1.
- Inspection and Sell My Car Assistance are request-and-follow-up services.
  They do not include payments, valuation, guarantees, workforce scheduling,
  inspector assignment, or generated inspection reports.
- Completed feature branches may be pushed automatically after verification.
  Main is merged only after review and approval.

## Implemented development sequence

The current branch contains the homepage work and the later linear feature
sequence through Sell My Car Assistance and Google-auth local repair:

- Homepage redesign, global navigation, search, latest listings, service and
  trust sections.
- Private inactive-listing visibility protection.
- Instant-publication alignment.
- Correct auto-parts category and condition filters.
- Upload ownership and abuse controls.
- Car, bike, and auto-parts create/edit/delete and image management.
- Recently viewed, favourites, comparison, saved searches, and alert outbox.
- Account profiles and secure password recovery.
- Dealer settings, logos, manual verification/revocation, and storefronts.
- Google-first OAuth plus verified-email registration.
- Admin listing moderation, audited edits, and user ban/unban.
- Inspection request administration and customer-visible history.
- Sell My Car Assistance public/admin flows and append-only history.

Most final database/browser acceptance remains deferred. Production providers
for alerts, email, images, database, and hosting still require configuration.

## Google-auth checkpoint (8 September 2026)

- Branch: `codex/branding-mobile`, based on remote `main` at `4e61232`.
- Google signup has been verified end to end against the local database.
- Confirmed local drift defect: `users.updated_at` was missing although the
  migration ledger and earlier repair guard treated auth schema as complete.
- The local repair now detects, restores, and verifies `users.updated_at`.
- Targeted Google-auth checks, the full project check suite, lint, and
  `build:safe` pass. Maximum reported First Load JS is 128 KB.
- The Google-auth repair, Stage 6.1 content, and privacy-safe map-location
  package are committed, pushed, and merged into `main`.
- The Google-auth repair was verified on 8 September 2026 with a successful
  local Google signup. PostgreSQL error `42703` for missing `users.updated_at`
  was the confirmed root cause.

## Stage 6.1 checkpoint

Stage 6.1 Legal and Content was implemented on `codex/legal-and-content` on 8
September 2026:

- Terms and Conditions
- Privacy Policy
- About JaniWheels
- Contact
- Safety information
- Report a Concern guidance
- Correct footer links and canonical metadata
- Automated legal/content checks and whole-site sweep coverage

The full project check suite, lint, production build, and targeted local HTTP
smoke checks pass. Comprehensive content approval, branding, accessibility, and
responsive browser review remain part of final QA as agreed.

## Current branding and responsive work

The privacy-safe approximate map-based ad location package is implemented. Its
exact coordinates remain private and public listing output uses only the
server-derived approximate coordinates.

Google Maps configuration has been added locally. Billing remains unresolved
and must be enabled before the final Google Maps browser acceptance test. Keep
this as an explicit final-QA blocker; do not expose the configured key.

Production branding, mobile responsiveness, and accessibility review began
on `codex/branding-mobile`. The shared shell includes official contact
links, narrow-screen navigation protection, visible keyboard focus, and a
skip-to-content route. Browser checks at 320px and 1440px cover the primary
public, seller, account, and dashboard routes without runtime errors or
horizontal overflow. Comprehensive final acceptance remains deferred until
this phase is complete.

The homepage popular-search cards now use current vehicle imagery, recognizable
city landmarks, and logo-visible manufacturer buildings. The car search also
uses lightweight, optimized transparent raster vehicle images for Hatchback,
Sedan, SUV, Crossover, Pickup, Van, Coupe, and Wagon, with each body type retaining a
distinct profile.

The homepage hero now uses a lightweight three-frame sedan, SUV, and motorcycle
cross-fade showcase. The sell call-to-action uses a separate dark sedan with a
subtle animated amber spotlight. Both treatments use optimized raster assets,
remain decorative for assistive technology, and become static when the visitor
prefers reduced motion. The owner approved these homepage visuals on 30
September 2026; comprehensive cross-route branding QA remains open.

The following launch work remains after the functional package:

- Required CI branch protection and remaining authorization, rollback and
  controlled-failure coverage in the existing DB/browser test framework
- Staging environment and production-like smoke tests
- Production PostgreSQL, durable image storage, email and alert delivery
- Cron scheduling, backups, logs/error monitoring, and uptime monitoring
- Accessibility, security, SEO, responsive, performance, and load acceptance
- Production deployment and controlled final merge

## Preserved idea inbox

These ideas were recorded as planned/TODO items and must not be silently marked
complete:

- Add a future blog/automotive-content platform with SEO and homepage
  integration.
- Continue refining the Sell Your Car journey around the implemented Sell My
  Car Assistance and Inspection services without expanding V1 into valuation
  or transactions.
- Complete the Google Maps browser acceptance test after billing is enabled;
  do not expose the configured key.

## Historical tracker reconciliation

The earlier synced workbook named
`JaniWheels_Complete_Feature_Development_Tracker.xlsx` was structurally intact
but had stale data from 16 August 2026. Its Dashboard still named the homepage
review as active and its Roadmap marked implemented packages as not started.
This was reconciled; use the maintained repository workbook for current status.

The `Dev 2` history references tracker versions 18 through 34, with version 34
created after the Google-auth startup repair. Those generated versions were not
found in project sources or the searched local Codex/download/document/temp
locations. The user authorized reconstruction from repository evidence on 8
September 2026. The reconciled workbook marks Stage 6.1 active, records Google
authentication as complete, and adds approximate map-based location as a
pending V1 feature.

## Resolved sequencing decisions

1. Stage 6.1 legal/content starts before branding and final QA.
2. Database acceptance runs alongside development.
3. Comprehensive browser, branding, mobile responsiveness, accessibility, and
   full QA run after functionality is complete.
4. Privacy-safe approximate map-based ad location is included in V1.

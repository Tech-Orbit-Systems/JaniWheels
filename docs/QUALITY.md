# CI and acceptance

Every pull request and main push runs `.github/workflows/quality.yml`. The job
creates an isolated PostgreSQL service, applies migrations, seeds curated data
and demo inventory, runs database assertions, checks, lint, a production build,
the route sweep, desktop/mobile Chromium tests, iPhone WebKit smoke tests, and a production dependency
audit. A failing step fails the
required check; repository branch protection must mark **Quality and
acceptance / acceptance** as required before a failure can block merging.

Run the same checks locally with a working local PostgreSQL server:

```bash
npm run test:acceptance:prepare
npx playwright install chromium webkit
npm run test:acceptance
```

The prepare command creates `janiwheels_acceptance_test` only if absent. The
acceptance runner uses this database, never the normal development database.
Demo seeding replaces demo sellers' listings within that isolated database.
It starts the production build on port 3101, runs the sweep and browser tests,
then stops its server. `--browser-only` skips migrations, reseeding and build
when only the browser tests need another run.

On a busy local machine, use
`npx cross-env PLAYWRIGHT_WORKERS=1 npm run test:acceptance`
to run browser tests one at a time. This preserves every case
and assertion while reducing competing browser processes. The default CI job
continues to use two workers.

CI is an ephemeral staging environment. A persistent online preview, durable
staging media storage, external uptime monitor, and branch protection still
need hosting and repository configuration before Stage 6.2 can be signed off.

## Media authorization acceptance

The authorization suite checks local upload GET and HEAD requests as owner,
another seller, anonymous visitor and administrator. Pending uploads and every
inactive listing status require owner/admin access; active listing photos and
saved profile/dealer identity photos are public. Upload responses are never
cached, and the Next image optimizer rejects upload paths. A real browser
checks the owner's edit preview. Foreign keys are replayed through actual
publish/edit HTTP actions, with unchanged database state and valid-owner
positive controls.

Local `UPLOAD_DIR` must be outside `public/` (default `.uploads`). Before
upgrading an existing local installation, stop its app, move `public/uploads`
to an absolute private directory, set `UPLOAD_DIR` to that directory, and
restart. Existing keys stay unchanged. Purge any previously public image caches
when deploying this change; responses already downloaded cannot be revoked.

This read-access protection is currently for the local provider. Cloudflare
still uses direct delivery URLs: private/signed delivery and live provider
acceptance remain a production launch gate. Do not claim local acceptance
proves Cloudflare object privacy.

## Administrative and expiry acceptance

Direct dealer verify/revoke replay is denied to sellers and anonymous visitors
without changing dealer state or audit history. Inspection and assistance
administration also denies the requesting customer, rejects invalid jumps,
missing customer updates and reopening terminal requests. Identical admin
payloads provide positive controls. Customer pages expose only that customer's
updates and exclude staff notes.

Expiry acceptance checks unauthenticated cron denial, due versus future active
listings, foreign/anonymous reactivation denial, the owner's fresh 30-day
window, and unchanged active/rejected/removed listings on replay. These tests
do not establish production cron scheduling or the full live crawler lifecycle.

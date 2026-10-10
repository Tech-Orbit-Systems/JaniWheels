# JaniWheels V1 deployment handoff

Updated: 8 October 2026. This document is for the external team that will
provision hosting and deploy JaniWheels. The development team supplies the
source, migrations, configuration contract and acceptance runbooks. The
deployment team owns infrastructure setup, secrets, DNS changes, live provider
checks, monitoring, backups and the release record.

## What to hand over

- Repository: `https://github.com/Tech-Orbit-Systems/JaniWheels`. Deploy a
  reviewed, merged `main` commit and record its full SHA. PR #6 and its current
  feature branch are not a production release until independent review, required
  checks and merge are complete.
- Runtime: persistent Node.js server (Node 22 recommended; minimum 20.11),
  PostgreSQL, HTTPS and durable Cloudflare Images. Next.js 15 uses `npm ci`,
  `npm run build` and `npm run start`; a static-file or PHP-only cPanel account
  cannot run this application. `npm run build:safe` is the separate verification
  build and writes to `.next-build`.
- Database: versioned SQL migrations in `drizzle/`. `npm run db:seed` inserts
  curated location, make/model/variant, parts category and feature reference
  data. It does not insert demo users or listings. Never run
  `src/db/seed/demo.ts`, acceptance account seed scripts, `db:reset` or
  `db:push` against production.
- Configuration template: `.env.example`. The actual `.env`, passwords, API
  tokens and customer data must be exchanged through the host's secret manager,
  not in the repository, a ZIP, chat or tracker.
- Operational runbooks: `docs/DEPLOYMENT.md`, `docs/ADMIN_BOOTSTRAP.md`,
  `docs/PRIVATE_MEDIA.md`, `docs/ALERT_DELIVERY.md`,
  `docs/RETENTION_DECISIONS.md`, `docs/OPERATIONS.md` and
  `docs/REGRESSION_CHECKLIST.md`.

## Infrastructure and configuration

| Area | Deployment team action |
| --- | --- |
| App | Provision a persistent Node server with outbound access to PostgreSQL, Resend, Cloudflare and Google; connect logs and set a restart policy. |
| Database | Provision production PostgreSQL and a separate staging/build database. Restrict access, use encrypted connections and back up before migrations. The production build reads page data from a reachable, migrated database. |
| Domain | Serve `https://janiwheels.com` as the canonical origin. Set `NEXT_PUBLIC_SITE_URL` to that exact origin and configure HTTPS and `www` redirection. |
| Images | Set both image provider variables to `cloudflare`, create the private variant and configure account ID, token, account hash and signing key. Verify private delivery, upload and deletion using the live account. |
| Email | Verify the sending domain with Resend and set `RESEND_API_KEY` and `EMAIL_FROM`. Test registration, password reset and saved-search delivery in a controlled mailbox. The old cPanel mailbox/data does not require migration, per the owner's 8 October 2026 confirmation. |
| Google | Set OAuth client ID/secret and register the exact `https://janiwheels.com/api/auth/google/callback` redirect. Configure a restricted Maps browser key if Maps is enabled. |
| Secrets | Generate distinct, strong `SESSION_SECRET` and `CRON_SECRET` values for staging and production. Set every required variable from `.env.example` in the host's secret manager. |
| Jobs | Configure authenticated scheduled calls for `expire-listings`, `purge-expired`, `saved-search-alerts` and `deliver-search-alerts`. Enable `retention-cleanup` and `retention-media` only after the approved preview, 30-day backup and independent deletion-ledger setup. Monitor job failures and backlog. |
| Recovery | Configure actual rolling 30-day encrypted backups and independent restricted deletion-ledger export. Rehearse restore and deletion replay before clearing maintenance mode. `BACKUP_RETENTION_DAYS=30` is a validation setting, not backup configuration. |
| Monitoring | Monitor `/api/health` externally, application errors, database, job failures, email backlog and provider errors. Name the incident recipient. |

`npm run check:deployment` validates variable shape and launch requirements but
does not test live provider access. Full settings and policy are in the linked
runbooks. Do not paste secret values into a handoff report.

## First deployment sequence

1. Create isolated staging and production resources. Set secrets and provision
   production and staging databases. Verify the intended database name before
   any command that writes data.
2. Deploy a reviewed `main` SHA to staging. Run `npm ci`, `npm run db:migrate`,
   `npm run db:seed`, `npm run check:deployment`, `npm run check`, `npm run lint`
   and `npm run build:safe` against the intended staging database. Run
   `npm run build` for the deployment artifact, then `npm run start`. CI's demo
   seed and acceptance account scripts belong only to its isolated test database.
3. On staging HTTPS, complete the provider, browser and real-device checks in
   `docs/REGRESSION_CHECKLIST.md`. Test the readiness endpoint, private images,
   email, Google sign-in, scheduled jobs, moderation and restore drill. Record
   observed results and defects; local/CI acceptance does not certify live
   services.
4. Take a verified production backup. Apply production migrations and curated
   reference seed, then build/deploy the same reviewed SHA. Run the approved
   retention inventory and preview before enabling cleanup. Bootstrap the first
   administrator using `docs/ADMIN_BOOTSTRAP.md` after normal registration and
   email verification.
5. The current public site is only a Coming Soon page and the owner confirms no
   old mailbox or site data needs migration. Public DNS currently resolves to
   the cPanel hosting server `5.101.140.80` with `ns91.host.com.pk` and
   `ns92.host.com.pk` nameservers (checked 8 October 2026). The deployment team
   must re-check the authoritative records on cutover day, set the provider's
   required apex/`www` records in the active DNS zone and verify HTTPS on both
   hostnames. Keep registrar ownership unchanged unless the owner requests a
   transfer. Old cPanel mail/calendar records may be retired once replacement
   services are configured; no legacy mailbox preservation is required.
6. Run post-cutover smoke tests and external monitoring; capture the exact SHA,
   migration version, DNS values, backup/restore evidence, provider tests and
   rollback procedure. Send any failures to development with steps, URL, device,
   timestamp and redacted logs. Do not report launch acceptance until the live
   checks pass.

## Release record to return

The deployment team should return the staging and production URLs, deployed
commit SHA, host/database/provider names (without credentials), migration and
seed result, DNS/HTTPS result, first-admin bootstrap result, scheduled job
status, backup retention and restore drill, monitored health, provider email
and image tests, device/browser results, and any blockers. Development will
reconcile this evidence into the master feature tracker.

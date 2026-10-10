# Deployment guide

## Required services

- Node.js 20.11 or newer
- PostgreSQL
- Durable image storage (Cloudflare Images)
- HTTPS domain for the production site

## Required environment

Configure the values documented in `.env.example`. At minimum:

- `DATABASE_URL`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SITE_NAME`
- `SESSION_SECRET`
- `IMAGE_PROVIDER` and the selected provider credentials
- `CRON_SECRET`

Do not use local filesystem uploads on an ephemeral host.
Runtime configuration is validated at startup. Run `npm run check:deployment`
before launch for the stricter public HTTPS/provider/secret checks. It prints
only variable names and corrections. Passing it does not prove provider access.
See [private media setup and migration](./PRIVATE_MEDIA.md),
[saved-search delivery](./ALERT_DELIVERY.md), and
[retention decisions](./RETENTION_DECISIONS.md).

## Database

For a new environment:

```bash
npm run db:migrate
npm run db:seed
```

`db:seed` inserts curated taxonomy, location, category and feature reference
data required by the product. It does not create demo users or listings. Back
up production before every schema migration. Never run
`src/db/seed/demo.ts`, acceptance account seeds, `db:reset` or `db:push` in
production.

## Build and verification

```bash
npm ci
npm run check
npm run lint
npm run build:safe
```

After deploying against a seeded staging database, start the application and
run `npm run sweep`. Manually verify account registration, login, seller
contact, listing submission, moderation, dealer registration and inspection
request submission. Use the [V1 regression checklist](./REGRESSION_CHECKLIST.md)
to record module-level results, evidence, blockers and retests for each release
candidate.

## Scheduled maintenance

Call the protected jobs with the configured `CRON_SECRET`:

```bash
curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" \
  https://janiwheels.com/api/cron/expire-listings

curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" \
  https://janiwheels.com/api/cron/purge-expired
```

Also schedule `saved-search-alerts` before `deliver-search-alerts`. Enable
`retention-cleanup` and `retention-media` only after the approved preview,
backup and independent ledger setup described in `RETENTION_DECISIONS.md`.

## Launch requirements

- Apply the approved JaniWheels logo and brand palette
- Configure production image delivery and validate image URLs
- Create the first administrator using the [preview-first bootstrap runbook](./ADMIN_BOOTSTRAP.md)
- Confirm moderation and dealer-verification operations
- Add privacy policy, terms and contact information
- Run database query-plan and load tests for the selected infrastructure
- Configure backups, logs, uptime monitoring and error reporting

Builds require a reachable, migrated PostgreSQL database for page data. Use
the isolated CI database or a dedicated staging/build database; never run demo
seeds against production. A successful build does not provision staging or
validate the production database/network credentials.

For the external deployment team and the evidence it must return, see
[deployment handoff](./DEPLOYMENT_HANDOFF.md).

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

## Database

For a new environment:

```bash
npm run db:migrate
npm run db:seed
```

Back up production before every schema migration. Never run the demo seed in
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

## Launch requirements

- Apply the approved JaniWheels logo and brand palette
- Configure production image delivery and validate image URLs
- Create the first administrator securely
- Confirm moderation and dealer-verification operations
- Add privacy policy, terms and contact information
- Run database query-plan and load tests for the selected infrastructure
- Configure backups, logs, uptime monitoring and error reporting

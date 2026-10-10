# AGENTS.md

Instructions for coding agents working in this repository.

JaniWheels is a Cars, Bikes and Auto Parts classified marketplace built with
Next.js 15, TypeScript, PostgreSQL and Drizzle. Read `docs/PROJECT.md` before
changing product behaviour.

## Setup

```bash
npm install
cp .env.example .env
npm run db:push && npm run db:seed
npm run dev
```

## Verify before claiming completion

```bash
npm run check
npm run lint
npm run build:safe
```

Use `npm run sweep` against a running application with a seeded database after
changing routes or interactive behaviour.

## Completed development workflow

- When a development package is complete and verified, commit its relevant
  changes, push its feature branch, and update the master feature tracker
  without asking for separate commit or push approval each time. The project
  owner authorized this workflow on 30 September 2026.
- Keep unrelated artifacts and local files out of commits. Record remaining
  acceptance gaps accurately in the tracker.
- A push is not approval to merge. Keep the PR review and main-branch merge as
  separate steps.

## Non-negotiable rules

1. Vehicle taxonomy is curated reference data: Make → Model → Generation →
   Variant. Never create taxonomy records from seller free text.
2. `src/lib/seo/indexation.ts` owns index/noindex and canonical policy.
   Unknown URL segments must 404. Run `npm run check:seo` after SEO changes.
3. Only the publishing/resynchronisation code may write denormalised listing
   facets.
4. Default to server components and keep First Load JS under 150 KB.
5. Never commit `.env`, secrets or production customer data.
6. Preserve the signed V1 scope. Payment gateways, featured ads, dealer
   subscriptions, financing, valuation, automatic imports, e-commerce, SMS
   OTP and inspection workforce tooling require a signed change request.

## Conventions

- Prices are integer PKR and phone numbers are stored in E.164 format.
- Every Zod constraint needs a user-facing message.
- Comments explain why, not what.
- Guard bulk inserts that could receive an empty array.
- Use an absolute `UPLOAD_DIR` when local development is started outside the
  project root.

## Current V1 gaps

- Core seller, buyer, account, dealer, moderation and manual-service workflows
  have local DB/browser acceptance. Use the master tracker and current PR checks
  for exact coverage; production/provider and real-device acceptance remain.
- Saved-search matching and delivery now have overflow, retry and concurrency
  acceptance; live email configuration, scheduling and mailbox checks remain.
- Cloudflare private UUID delivery has mock-provider checks; live variants,
  existing custom-ID migration and provider lifecycle acceptance remain.
- Runtime/launch validation, admin bootstrap, readiness and structured error
  events are implemented. Hosting, production DB, backups and external
  monitoring still need deployment configuration.
- Homepage branding, mobile navigation and enlarged-text/tablet checks are
  implemented. Real-device/screen-reader, HTTPS and production load acceptance
  remain. Inspection workforce, valuation and transaction tooling are excluded.
- Client approved decision A exactly on 4 October 2026: account recovery 30 days,
  inactive ads/closed services 12 months, resolved complaints 24 months,
  detailed analytics and terminal alert PII 90 days, backups 30 days and
  evidence holds reviewed every 90 days. Follow docs/RETENTION_DECISIONS.md.
  Never delete held evidence or resume a restored backup before deletion replay.
  Owner approved B1 on 4 October 2026: no ordinary
  seller verification badge in V1. Existing manual dealer verification remains.
  See docs/RETENTION_DECISIONS.md and docs/PROJECT.md.

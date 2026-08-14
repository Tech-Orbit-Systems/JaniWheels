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

- Sellers can currently create cars only; bike and parts creation is pending.
- Listing edit/delete UI, comparison, favourites, recently viewed and saved
  search UI are pending.
- Profile editing, password reset and basic email alerts are pending.
- Sell My Car Assistance and inspection/admin operations are pending.
- Dealer verification administration and broader admin controls are pending.
- Production branding, mobile navigation and full launch QA are pending.

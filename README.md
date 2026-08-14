# JaniWheels

JaniWheels is a responsive classified marketplace for cars, bikes and auto
parts in Pakistan. This repository is aligned to the signed V1 proposal dated
August 13, 2026.

## V1 boundary

The product foundation supports:

- Cars, bikes and auto-parts classified listings
- User accounts, profiles and seller dashboards
- Listing creation, editing, deletion, moderation and sold status
- Search, filters, sorting, pagination and listing comparison
- Call and WhatsApp seller contact
- Favourites, recently viewed listings and saved searches
- Dealer profiles, storefronts, basic dashboards and manual verification
- Simplified inspection requests and Sell My Car assistance
- Fraud reports, moderation and administration
- Responsive UI, SEO foundations and secure media handling

The signed V1 does **not** include payment gateways, paid or featured ads,
dealer subscriptions or billing, financing, banking or insurance, market-price
prediction, automated imports, e-commerce checkout, internal live chat, SMS
OTP, multilingual functionality, or inspection workforce management.

## Stack

- Next.js 15 App Router and React 19
- TypeScript
- PostgreSQL and Drizzle ORM
- Tailwind CSS 4

## Local setup

```bash
npm install
cp .env.example .env
npm run db:push
npm run db:seed
npm run dev
```

`DATABASE_URL`, `SESSION_SECRET` and the public site URL must be configured in
`.env`. Never commit that file.

To add local demonstration inventory:

```bash
npx tsx src/db/seed/demo.ts
```

Never run the demo seed against production.

## Verification

```bash
npm run check
npm run lint
npm run build:safe
```

`npm run check` runs TypeScript and the pure SEO-policy assertions. The route
sweep requires a running application with a seeded database:

```bash
npm run sweep
```

See `docs/PROJECT.md` for architecture and `docs/DEPLOYMENT.md` for deployment
requirements.

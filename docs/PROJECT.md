# JaniWheels V1 architecture

## Product boundary

JaniWheels V1 is a classified marketplace, not a transaction platform. Buyers
discover listings and contact sellers directly. The marketplace does not
collect vehicle or parts payments and does not manage shipping or fulfilment.

The shared listing model supports three verticals:

| Vertical | Core data |
|---|---|
| Cars | Curated make, model, generation and variant taxonomy; vehicle details |
| Bikes | Curated make, model and variant taxonomy; bike details |
| Auto Parts | Category, condition, brand and compatibility; classified contact only |

## Application modules

| Module | Location | Responsibility |
|---|---|---|
| Authentication | `src/lib/auth` | Password hashing, sessions and account actions |
| Listings | `src/lib/listings` | Validation, publishing, search, details and seller actions |
| Marketplace routes | `src/app/used-*`, `src/app/auto-parts` | Browse and SEO facet pages |
| Seller dashboard | `src/app/dashboard` | Listing status, buyer-interest counts and management |
| Dealers | `src/app/dealers`, `src/lib/dealers` | Profiles, storefronts, basic dashboard and registration |
| Trust | `src/lib/trust`, `src/app/admin` | Reports, moderation and inspection requests |
| SEO | `src/lib/seo` | Facet parsing, canonicals, indexation and structured data |
| Media | `src/lib/images`, `src/app/api/upload` | Listing image storage abstraction |
| Database | `src/db/schema` | PostgreSQL schema and Drizzle definitions |

## Database design

`listings` stores shared fields and denormalised search facets. Vertical detail
tables hold fields that genuinely differ between cars, bikes and parts. Only
the publishing/resynchronisation code may write denormalised taxonomy columns.

Search stays in PostgreSQL for V1. Indexed facet columns are sufficient for the
agreed conditional target of 20,000+ listings, subject to production query-plan
and load testing on the selected infrastructure.

Authentication stores scrypt password hashes and hashed random session tokens.
The session cookie is HTTP-only, secure in production and same-site.

## SEO model

Facet URLs are parsed through a registry with canonical ordering. Only approved
facet combinations may be indexed; range and sort parameters remain noindex.
Unrecognised segments must return 404.

Run `npm run check:seo` after changing anything under `src/lib/seo`.

## Scope guardrail

Do not add the following without a signed change request:

- Payment gateways, orders or billing
- Featured ads, paid promotion or bump-to-top
- Dealer subscriptions or paid plans
- Financing, insurance or banking integrations
- AI valuation, market-price prediction or recommendations
- CSV/spreadsheet scraping or automatic third-party imports
- Cart, checkout, shipping, fulfilment or order tracking
- Live internal chat or WhatsApp Business API
- SMS OTP
- Inspector assignment, scheduling, payments, apps or report generation
- Advanced CRM, ERP, BI, analytics or multilingual functionality

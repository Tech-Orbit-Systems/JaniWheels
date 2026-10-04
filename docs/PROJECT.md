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
| Dealers | `src/app/dealers`, `src/lib/dealers`, `src/app/admin/dealers` | Registration, owner settings, storefronts and audited manual verification |
| Trust | `src/lib/trust`, `src/app/admin` | Reports, moderation, audited listing controls, user access controls and inspection requests |
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

Google is the primary account entry point and uses Authorization Code with
PKCE, state and nonce. The callback validates Google's signed ID token,
audience, issuer, expiry, nonce and verified-email claim before establishing a
local session. Provider subjects, rather than provider email addresses, are the
stable identity keys. Existing mobile/password login remains supported.

Email/password registration is secondary and requires a single-use 24-hour
verification link before sign-in. Buyer accounts may omit a phone number, but
car, bike and parts posting routes and actions require one. Numbers remain
unverified because SMS OTP is outside the signed V1 scope. Authentication
stores scrypt password hashes and hashed random session tokens. The session
cookie is HTTP-only, secure in production and same-site.
Password reset links use 256-bit random tokens, store only SHA-256 digests,
expire after 30 minutes, are single-use and revoke every existing session when
consumed. Resend is the production email adapter; local development prints the
reset URL in the server terminal when email credentials are absent.

Dealer verification is a manual admin decision. The badge is derived directly
from `dealers.verified_at`, and every approval, revocation or automatic review
reset is appended to `moderation_log`. Verified profiles return to review when
the owner changes business identity details or the public logo.

Owner decision B1, approved 4 October 2026: ordinary sellers do not receive a
"Verified Seller" badge in V1. Email verification does not establish identity,
phone verification or vehicle ownership. Individual-seller manual verification
(tracker JW-053) is removed from V1 by this owner decision; dealer verification
continues under its existing audited manual process.

Administrators have an all-status listing console and a user access console.
Listing flag, approval, rejection, reinstate, removal and administrator-edit
events are appended to `moderation_log`. Manual bans revoke all active sessions;
self-ban and administrator-ban are blocked. A seller may fix and resubmit a
rejected ad twice, while the third rejection permanently removes that ad.

Inspection administration is request-based: staff can move a request through
requested, contacted, confirmed, completed or cancelled states, record private
follow-up notes, and publish selected updates to the customer dashboard. Every
change is append-only in `inspection_events`. This does not assign inspectors,
optimise workforce schedules, collect payment or generate inspection reports.

Sell My Car Assistance is also request-based. A seller submits structured
vehicle, document, condition, timing and contact details. Staff can move the
case through contact, detail confirmation, ad preparation, ad live, buyer
follow-up and final sold/cancelled states. Customer-visible updates and private
staff notes are retained in an append-only event history. V1 does not provide
automatic valuation, buy the vehicle, guarantee a buyer/price/timeline, collect
payment or manage ownership transfer.

## Approved retention policy

Client decision A was approved exactly as proposed on 4 October 2026. Account
closure immediately hides profiles and listings, stops alerts and revokes all
sessions. Authenticated recovery lasts 30 days; afterward personal data is
redacted except necessary held complaint evidence. Inactive listings/photos and
closed manual service cases retain personal content for 12 calendar months;
resolved reports retain necessary evidence for 24 months. Raw usage/contact
events and terminal alert payloads expire after 90 days. Complaint holds require
an accountable person and 90-day review, with no automatic release. Inactivity
alone never closes an account. See `RETENTION_DECISIONS.md` for operator commands,
30-day backup expiry and mandatory deletion replay before restored service opens.

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

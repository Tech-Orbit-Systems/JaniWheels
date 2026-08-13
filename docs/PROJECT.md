# JaniWheels — Project Documentation

A vehicle classifieds marketplace for Pakistan: used cars, motorcycles and
auto parts, with dealer tooling, paid promotion, and an independent vehicle
inspection service.

This document covers what the product does, how it is built, and what is
deliberately not built yet. It is written to be readable both by a developer
picking up the codebase and by a non-technical stakeholder evaluating it.

---

## 1. What the product is

A marketplace where private sellers and dealers list vehicles, and buyers find
and contact them directly. Revenue comes from paid visibility, dealer
subscriptions, and services layered on top of the listings.

**The one thing that makes it different from a generic classifieds site:**
every listing shows how its price compares to the real market for that exact
variant, year and city. A buyer looking at "PKR 48 lacs" normally has no idea
whether that is a bargain or a fantasy. This site tells them, and refuses to
guess when it does not have enough comparable data to be honest.

### Who uses it

| User | What they do |
|---|---|
| **Private seller** | Posts up to 3 free ads, sees how many buyers revealed their phone number, pays to promote |
| **Buyer** | Searches, filters, compares prices against the market, calls the seller |
| **Dealer** | Branded storefront, bulk-uploads inventory by spreadsheet, monthly subscription, lead analytics |
| **Staff** | Reviews reported and pending listings from a moderation queue with a full audit log |

---

## 2. Feature modules

### 2.1 Listings and search

Three verticals — cars, bikes, auto parts — share one listing engine and one
search experience, discriminated by a `vertical` column.

- Filter by make, model, variant, city, province, body type, transmission,
  fuel, assembly, country of origin, features, and ranges for price, year,
  mileage and engine size.
- Sort by recency, price, model year or mileage.
- Paginated (not infinite scroll) so every listing is reachable by a search
  engine.
- Featured listings sort first; "bump to top" resets a listing's position.

**Why it matters commercially:** the filters are also the URL structure, and
the URL structure is what earns free search traffic. See §4.

### 2.2 Price intelligence

Two customer-facing features built on the same data:

1. **Price-vs-market badge** on every listing — "Great price · 11% below the
   median of 10 similar 2021 Alto listings nationwide".
2. **Public price calculator** at `/price-calculator` — answers "what is my
   car worth", which is one of the highest-volume searches in this market and
   the cheapest possible way to acquire a seller.

A nightly job recomputes 25th/50th/75th percentile prices per variant, year
and city from live and sold listings.

**Both refuse to answer below a minimum sample size.** A fabricated valuation
is worse than none, because the user acts on it — they price their car wrong
or turn down a fair offer. The badge needs 8 comparables, the calculator 5.

### 2.3 Selling

- Phone-OTP signup. No email, no password.
- Guided listing form with cascading make → model → variant selection.
- Photo upload with server-side validation.
- Phone numbers and links are automatically stripped from descriptions, so
  buyer contact happens through the platform where it can be measured and
  charged for.
- Free tier: 3 live ads for private sellers.

### 2.4 Buyer contact and lead tracking

The seller's phone number is **not** in the page HTML. It is revealed by an
explicit click, which records a lead event.

This is the most commercially important mechanism in the product:

- It is the north-star metric (leads per listing, not page views).
- It is the evidence that justifies a dealer's subscription renewal.
- It is the only honest basis for pricing a featured slot.
- It prevents a scraper harvesting every seller's number in one crawl.

### 2.5 Monetisation

| Product | Model |
|---|---|
| Featured ads / bump-ups | One-off, PKR 500 – 4,500 per listing |
| Dealer subscriptions | Monthly, PKR 5,000 – 40,000 by tier |
| Inspection | PKR 3,500 – 9,500 per vehicle |
| Finance & insurance leads | Per qualified enquiry, paid by the bank/insurer |

Payments run through **JazzCash** and **Easypaisa** hosted checkout — wallets,
not cards, because card penetration in Pakistan is low and Stripe does not
serve PK merchants.

Early renewal of a subscription extends from the existing expiry rather than
from today, so renewing early never costs the dealer days.

### 2.6 Dealer tooling

- **Branded storefront** at `/dealers/{name}`, indexable by Google.
- **Bulk CSV import** — the feature dealers actually pay for. A showroom with
  thirty cars will not retype them into a web form.
  - Matches column headers loosely, so an existing export usually works as-is
    (`Brand`, `Model Year`, `Asking Price`, `KMs`, `Location` all recognised).
  - Understands local price notation: `"48.5 lacs"` → 4,850,000.
  - Handles Excel quirks: quoted commas, embedded newlines, UTF-8 BOM.
  - Previews before writing anything, imports the valid rows, and reports the
    rest by row number with a specific reason.
  - **Never invents a model from an unrecognised spelling** — that would
    permanently corrupt the price data and the search structure.
- **Lead analytics** — daily phone-reveal chart, best performers, and a
  "getting no calls" panel listing cars live over a week with zero contact.
  That last panel is the one that earns the renewal: it is the only view a
  dealer can act on.

### 2.7 Trust and safety

- **Inspection booking** — independent 200-point check, priced by engine size,
  paid by the buyer rather than the seller so the report is honest.
- **Reporting** — one click, no login required, because the people best placed
  to spot a scam will not create an account to tell you.
- **Moderation queue** — pending and reported listings, approve/remove with a
  mandatory reason, written to an append-only audit log.
- Abuse controls: one report per person per listing, and a deliberately high
  auto-hide threshold so reports cannot be weaponised against a competitor.

### 2.8 Scheduled jobs

| Job | Cadence | Purpose |
|---|---|---|
| `price-snapshots` | Nightly | Rebuild price percentiles |
| `expire-listings` | Hourly | Retire listings past their paid window |
| `purge-expired` | Daily | Clear dead sessions and used OTP codes |

Triggered by an authenticated HTTP endpoint, so any scheduler works.

---

## 3. Technology stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15** (App Router), React 19 | Server-rendered HTML on every page — non-negotiable when search traffic is the business |
| Language | **TypeScript** (strict) | Catches the class of bug that silently corrupts listings |
| Database | **PostgreSQL 17** | Relational taxonomy, percentile functions, row-level locking for payments |
| ORM | **Drizzle** | SQL-transparent; no hidden query generation on the hot search path |
| Styling | **Tailwind CSS v4** | No runtime cost, no component library weight |
| Auth | Phone OTP, hashed, DB sessions | Phone is identity in this market |
| Payments | JazzCash + Easypaisa | The wallets people actually use |
| Images | Local disk or Cloudflare Images | Provider-swappable without a data migration |
| Runtime | Node.js 20+ | — |

### Deliberate non-choices

- **One frontend, not two.** The incumbent runs a server-rendered desktop site
  and a separate React SPA for mobile web. Every feature ships twice and the
  two drift apart.
- **No charting library.** The analytics chart is inline SVG — a dependency
  would cost 40–100 KB of JavaScript to draw thirty rectangles.
- **No search engine yet.** PostgreSQL handles the current catalogue. Swap in
  Typesense when typo tolerance starts mattering; the interface is isolated.

### Performance budget

Under **150 KB of JavaScript** and **1.5s LCP** on a mid-range Android over
4G. That is the actual device and connection most of this traffic uses.

Current: **103–114 KB First Load JS** across every route. Default is a server
component; a component becomes client-side only when it needs state.

---

## 4. The SEO engine

This is the part that determines whether the business works, so it gets its
own section.

### The problem

A used-car search has ~15 filterable dimensions. Exposed naively as crawlable
URLs, that is tens of millions of near-identical thin pages. Google spends its
crawl budget on garbage, concludes the site is low quality, and demotes all of
it. This is the single most common way classifieds sites fail at SEO, and
recovery is slow.

### The solution — three mechanisms

**1. A closed facet registry.** Anything not explicitly registered cannot
appear in a URL. An unrecognised segment is a 404, never a silently ignored
filter.

**2. Deterministic ordering.** `/used-cars/toyota-corolla/lahore` and
`/used-cars/lahore/toyota-corolla` are the same result set, so only one may
exist. The other permanently redirects to it.

**3. An indexation whitelist.** A page is indexable only if a real person
would plausibly type it into Google.

```
/used-cars/toyota-corolla/lahore                      → index
/used-cars/toyota-corolla/lahore/tr_automatic?pr=-3400000
                                                      → noindex, canonical ↑
```

Non-whitelisted combinations canonicalise to their **nearest indexable
ancestor**, found by searching the subset lattice for the most specific
whitelisted combination — not by naively dropping filters, which loses
relevance.

Range filters (price, mileage) are never indexable. Sorted views are
`noindex` and canonicalise to the unsorted page. Every indexable facet must
produce a distinct page title — enforced by an automated check.

### Supporting details

- Keyword-rich listing URLs with a stable trailing ID, so titles can change
  without breaking links (the old URL 301s to the new one).
- `Vehicle`, `Offer`, `AutoDealer`, `BreadcrumbList`, `ItemList` and `Service`
  structured data.
- XML sitemap that emits **only** indexable URLs that clear a minimum
  inventory threshold — never a page with two cars on it.
- Internal linking module that surfaces model×city pages with real inventory.
- Sold and expired listings drop out of the index automatically.
- Staging deployments serve `Disallow: /` so they cannot be indexed.

---

## 5. Data model

The load-bearing decision is that **vehicle taxonomy is curated reference
data, never free text**:

```
Make → Model → Generation → Variant
```

Every listing hard-links to a `variant_id`. A user can never type a model
name. This is not a UX preference:

- Facet pages need a stable entity to rank.
- Price analytics need "2020 Corolla Altis 1.6" to mean exactly one thing.
- Comparison needs a graph, not a pile of strings.

Let `toyota corola` into the database once and all three break permanently.

28 tables across geography, taxonomy, users, listings, analytics, commerce and
trust. Seeded with 7 provinces, 60 cities, 20 car makes, 88 car models, 8 bike
makes, 32 part categories.

Notable choices:

- **Denormalised facet columns** on `listings` (make, model, body type, fuel…)
  so search never joins three tables on the hottest query. The sync burden
  lives in exactly one function.
- **`lead_events` and `price_snapshots` exist from day one.** These are the
  tables people add in year two and spend year two guessing without.
- **Orders detach rather than cascade** when a listing is deleted. A payment
  record must survive the thing it paid for.

---

## 6. Security

| Area | Approach |
|---|---|
| Sessions | 256-bit token in an httpOnly cookie; only its SHA-256 hash is stored |
| OTP | Hashed and phone-salted, 5/hour rate limit, 5-attempt cap, single use |
| Payments | Signature verified on every callback; amount re-checked against our own order; callbacks idempotent under retry; **unsigned callbacks rejected outright** |
| Uploads | Magic-byte validation — a PHP file labelled `image/jpeg` is rejected, SVG is refused entirely |
| Headers | CSP, HSTS, `X-Frame-Options`, `nosniff`, referrer policy |
| Access control | Ownership checked server-side on every mutation; admin routes redirect rather than 403 |
| Open redirect | Post-login redirects restricted to same-site paths |

**Known exposure:** JazzCash's hosted checkout requires the merchant API
password as a browser form field, so it is visible in page source. This is
their documented flow, not a defect in this code. The integrity salt — the
value that actually authenticates a request — never leaves the server. If the
merchant account supports the server-to-server API, use it instead.

---

## 7. Testing

```
npm run check      typecheck + all three suites
npm run sweep      crawl every route shape against a running server
```

| Suite | Assertions | Covers |
|---|---|---|
| `check:seo` | 37 | Facet URLs, indexation policy, canonicals, title collisions |
| `check:payments` | 39 | Forgery, replay, amount tampering, declines, bump quota, subscription renewal, both gateways |
| `check:import` | 26 | CSV parsing, header aliases, price notation, row validation, commit |
| `sweep` | 98 URLs | Status, missing headings, empty pages, broken images, error markers |

The sweep exists because status-code checks kept passing while real pages were
broken. **An HTTP 200 is not evidence that a page works.**

---

## 8. Not built

Stated plainly so nothing is assumed:

| Gap | Note |
|---|---|
| Inspector field app, report PDFs | Booking works; the operations side is a logistics build |
| Parts checkout | Parts list and browse; transactions happen off-platform |
| Sell wizard for bikes and parts | Browse works; posting is cars-only |
| Saved searches / favourites | Tables exist, no interface |
| Email notifications | Phone/SMS only |
| Urdu localisation | Structure supports it, translations not done |
| Real gateway transaction | Logic fully unit-tested; no live payment has completed |

---

## 9. Repository layout

```
src/
├── db/
│   ├── schema/          Drizzle tables (start here)
│   └── seed/            Geography, vehicle catalogue, demo data
├── lib/
│   ├── seo/             Facet registry, indexation policy, structured data
│   ├── listings/        Search, publishing, price positioning
│   ├── payments/        Gateway drivers, order lifecycle
│   ├── dealers/         CSV import, analytics
│   ├── auth/            OTP, sessions
│   ├── pricing/         Public valuation
│   └── analytics/       Nightly rollups
├── components/
└── app/                 Routes
scripts/                 Verification suites
docs/                    This file and DEPLOYMENT.md
```

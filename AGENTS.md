# AGENTS.md

Instructions for AI coding agents working in this repository.

JaniWheels is a vehicle classifieds marketplace for Pakistan (cars, bikes,
auto parts) built with Next.js 15, TypeScript, PostgreSQL and Drizzle.

Read `docs/PROJECT.md` for the full architecture. This file covers what will
bite you.

---

## Setup

```bash
npm install
```

```bash
cp .env.example .env    # then fill DATABASE_URL at minimum
```

```bash
npm run db:push && npm run db:seed
```

```bash
npm run dev
```

`db:seed` loads geography and the vehicle catalogue (idempotent).
`npx tsx src/db/seed/demo.ts` adds ~1,400 fake listings for development —
**never run it against production.**

---

## Verify before you claim anything works

```bash
npm run check     # typecheck + 102 assertions across 3 suites
```

```bash
npm run sweep     # crawls 98 URL shapes against a running dev server
```

| Suite | Covers |
|---|---|
| `check:seo` | Facet URLs, indexation policy, canonicals, title collisions |
| `check:payments` | Signature forgery, replay, amount tampering, bump quota, subscriptions, both gateways |
| `check:import` | CSV parsing, header aliases, price notation, row validation, commit |
| `sweep` | Status codes, missing headings, empty pages, broken images |

**An HTTP 200 is not evidence that a page works.** Most bugs found in this
codebase passed status-code checks and only surfaced when something actually
used the code. If you change interactive behaviour, exercise it in a browser
or add an assertion — do not report it as verified otherwise.

---

## Rules that are not negotiable

### 1. Vehicle taxonomy is curated reference data, never free text

```
Make → Model → Generation → Variant
```

Every listing hard-links to a `variant_id`. Users select; they never type a
model name. Do not add a code path that creates a make/model/variant from user
input — including "helpfully" resolving a typo during CSV import. Facet pages,
price analytics and comparisons all depend on one variant meaning one thing,
and the corruption is permanent.

### 2. Only whitelisted facet combinations may be indexed

`src/lib/seo/indexation.ts` decides `index` vs `noindex` and computes
canonicals. A used-car search has ~15 filterable dimensions; exposed naively
that is tens of millions of thin URLs and Google demotes the whole domain.

- Unrecognised URL segments must 404, never be silently ignored.
- Every indexable facet must produce a **distinct** page title (asserted).
- Range filters (price, mileage) are never indexable.
- Run `npm run check:seo` after touching anything in `src/lib/seo/`.

### 3. The payment callback is the only thing that may mark an order paid

- Verify the signature before trusting any field.
- Re-check the amount against our own order row.
- Callbacks must stay idempotent — gateways retry.
- **Never** treat a missing signature as "nothing to verify". That exact bug
  shipped in the Easypaisa driver and allowed forged payments.
- Run `npm run check:payments` after touching `src/lib/payments/`.

### 4. Denormalised columns have one writer

`listings` carries copies of make/model/body type/fuel/etc. for search speed.
Only `publishCarListing` and `resyncListingFacets` in
`src/lib/listings/publish.ts` may write them. A listing whose denormalised
columns disagree with its variant is invisible on its own facet page and
nothing surfaces the bug.

### 5. Performance budget

Under 150 KB First Load JS (currently 103–114 KB). Most traffic is a mid-range
Android on 4G. Default to server components. Do not add a charting or
component library — the existing chart is inline SVG for this reason.

---

## Gotchas that have already cost time

| Symptom | Cause |
|---|---|
| Forms do nothing, no request reaches the server | CSP blocking React hydration. Dev needs `'unsafe-eval'`; it is conditional in `next.config.ts`. Check the browser console first. |
| Uploaded images 404 | Upload path resolves from `process.cwd()`. Set `UPLOAD_DIR` to an absolute path if the server starts from another directory. |
| `malformed array literal` | Drizzle expands a JS array into a parameter tuple, not a Postgres array. Use `IN (${sql.join(...)})`, never `= ANY(${jsArray})`. |
| `values() must be called with at least one value` | Drizzle rejects `.values([])`. Guard every bulk insert that can receive an empty array. |
| Dev server serves stale/broken chunks | `next build` was run while `next dev` was live; they share `.next`. Use `npm run build:safe`. |
| Payment form silently blocked | CSP `form-action` must allowlist the gateway origin. |

---

## Conventions

- **Comments explain why, not what.** Especially where the obvious approach is
  wrong — most comments here exist because something failed in a
  non-obvious way.
- Prices are integer PKR. Display uses lacs/crore (`src/lib/format.ts`).
  JazzCash quotes **paisa**; Easypaisa quotes **rupees**. Confusing them bills
  the customer 100×.
- Phone numbers are stored E.164 (`+923001234567`), displayed `0300 1234567`.
- Every Zod constraint needs its own message, or raw library text
  ("String must contain at least 10 character(s)") leaks into the UI.
- Never delete financial records on cascade. `orders.listing_id` is
  `ON DELETE SET NULL` on purpose.

---

## Known gaps (deliberate, do not "fix" silently)

- No mobile app.
- Sell wizard is cars-only; bikes and parts can be browsed but not listed.
- Saved searches and favourites: tables exist, no UI.
- No email; SMS only.
- Inspection booking works; inspector app and report PDFs do not exist.
- No live payment has ever completed — gateway field names must be verified
  against the merchant's own documentation before launch.
- Urdu localisation not done.

---

## Do not commit

`.env` (gitignored). If you add a secret, add it to `.env.example` with an
empty value and document it — never with a real value.

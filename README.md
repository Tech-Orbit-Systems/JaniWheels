# AutoBazaar

A vehicle classifieds marketplace for Pakistan — used cars, bikes and auto parts.

Next.js 15 (App Router) · TypeScript · PostgreSQL · Drizzle · Tailwind v4

---

## Getting started

**Prerequisites:** Node.js 20.11+ and PostgreSQL 16/17.

```bash
npm install
```

```bash
cp .env.example .env
```

Fill in `DATABASE_URL`, then create the schema and load the taxonomy:

```bash
npm run db:push
```

```bash
npm run db:seed
```

```bash
npm run dev
```

### Running the site day to day

```bash
.\start-dev.ps1
```

Starts PostgreSQL if it isn't already, then the dev server, then tells you to
open http://localhost:3000. Safe to run when things are already up — it checks
first. `Ctrl+C` stops the site; PostgreSQL keeps running (that's fine, and it
means the next start is instant).

`.\stop-dev.ps1` shuts both down if you want the ports back.

**Two services, not one.** The site needs PostgreSQL running or every page
errors — and because the database runs as a plain process rather than a
Windows service, it does **not** come back automatically after a reboot. If
pages break with a connection error, PostgreSQL is almost certainly down.

### Local Postgres without an installer

This repo was set up against a portable Postgres cluster in
`C:\Users\shahe\pg17` — no Windows service, no admin rights, nothing running
at boot. Start and stop it explicitly:

```bash
C:\Users\shahe\pg17\pgsql\bin\pg_ctl.exe -D C:\Users\shahe\pg17\data -l C:\Users\shahe\pg17\pg.log -o "-p 5432 -h 127.0.0.1" start
```

```bash
C:\Users\shahe\pg17\pgsql\bin\pg_ctl.exe -D C:\Users\shahe\pg17\data stop
```

It listens on 127.0.0.1 only and uses `trust` auth — fine for a local dev
cluster that is never exposed, and not a configuration to copy to a server.

### Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check` | typecheck + both check suites |
| `npm run check:seo` | **Indexation policy assertions — run before touching `facets.ts` or `indexation.ts`** |
| `npm run check:payments` | **Payment invariants — run before touching anything under `lib/payments/`** |
| `npm run check:import` | CSV parsing and bulk-import row validation |
| `npm run build:safe` | Build into `.next-build` so it can't clobber a running dev server |
| `npm run db:push` | Sync schema to the database |
| `npm run db:seed` | Load geography + vehicle taxonomy (idempotent) |
| `npm run db:studio` | Browse the data |
| `npm run db:generate` | Emit a SQL migration |

## Gotcha: the CSP is environment-dependent

`next.config.ts` ships a real Content-Security-Policy, but Next's dev server
compiles with `eval` for React Refresh. Without `'unsafe-eval'` in
development **nothing hydrates** — every client component renders as dead
HTML, forms silently do nothing, and the only clue is a CSP `EvalError` in the
browser console. Production keeps the strict policy.

If you ever see a form that does nothing and no request in the server log,
check the browser console before checking anything else.

## Scheduled jobs

Three jobs, triggered by any external scheduler hitting an authenticated
endpoint. All are safe to re-run.

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-site/api/cron/price-snapshots
```

| Job | Cadence | What it does |
|---|---|---|
| `price-snapshots` | nightly | Rebuilds the percentile tables behind the price badge and calculator. Swaps atomically so readers never see a half-built table. |
| `expire-listings` | hourly | Expires listings past their paid window. Without it the site fills with cars that sold months ago. |
| `purge-expired` | daily | Clears dead sessions and consumed OTPs. |

The endpoint 401s without the secret: `expire-listings` is destructive and
`price-snapshots` is expensive, so an open endpoint is both a DoS lever and a
way to quietly unpublish the catalogue.

## Payments — read before going live

`src/lib/payments/` implements JazzCash and Easypaisa hosted checkout from
their published integration patterns. **The field names, hash input ordering
and endpoints must be verified against your own merchant documentation in
sandbox before taking real money** — both gateways revise these between
portal versions and they differ per account (JazzCash v1.1 vs v2.0, Easypaisa
MA vs OTC). Note also that JazzCash quotes amounts in *paisa* and Easypaisa
in *rupees*; confusing them bills the customer 100×.

What must not change is the security shape, which `check:payments` asserts:

1. **The callback is the only thing that may mark an order paid.** Never trust
   a browser redirect — it is user-controlled.
2. **Verify the signature before trusting any field.**
3. **Re-check the amount against your own order row.** A correctly-signed
   callback claiming "paid PKR 1" for a PKR 1,500 package is rejected and the
   order marked failed.
4. **Callbacks are idempotent.** Gateways retry; crediting a promotion twice
   is a silent revenue leak nobody reports.

`check:seo` is not optional ceremony. Facet bugs are invisible in the UI — a
page that should be `noindex` renders identically to one that should not —
and the checks caught a real one during the build: `{fuel, transmission}` was
collapsing to the bare root instead of to `/used-cars/fu_hybrid`, silently
throwing away a whitelisted page's relevance.

---

## The two decisions everything else follows from

### 1. The taxonomy is curated reference data

```
Make → Model → Generation → Variant
```

Every listing hard-links to a `variant_id`. A user can never type a make or
model as free text. This is not a UX preference — facet pages need a stable
entity to rank, price analytics need "2020 Corolla Altis 1.6" to mean exactly
one thing, and comparisons need a graph rather than a pile of strings. Let
`toyota corola` into the database once and all three break permanently.

Extending the catalogue in `src/db/seed/vehicles.ts` is cheap. Changing its
shape later is not.

### 2. Indexable URLs are a closed, whitelisted set

A used-car search has ~15 filterable dimensions. Exposed naively as crawlable
URLs that is tens of millions of near-identical thin pages, and the reliable
result is that Google demotes the entire domain. This is the single most
common way classifieds sites fail at SEO.

Three mechanisms prevent it, in `src/lib/seo/`:

| File | Responsibility |
|---|---|
| `facets.ts` | Closed facet registry. Deterministic segment ordering, so one result set has exactly one URL. |
| `indexation.ts` | The whitelist. Decides `index` vs `noindex,follow`, and computes the canonical. |
| `resolver.ts` | Slug → entity lookups, request-cached. |

The rule: **a page is indexable only if a real person would plausibly type it
into Google.**

```
/used-cars/toyota-corolla/lahore                    → index
/used-cars/toyota-corolla/lahore/tr_automatic/ft_sunroof?pr=-3400000
                                                     → noindex, canonical ↑
```

Non-whitelisted combinations canonicalize to their **nearest indexable
ancestor** — facets are dropped by priority until what remains is whitelisted.
Range filters (price, mileage, year) never appear in a path and are never
indexable.

In development every search page prints its indexation decision in an amber
banner. Getting this wrong is otherwise silent until it is expensive.

---

## Project layout

```
src/
├── db/
│   ├── schema/          # Drizzle tables — start here
│   │   ├── taxonomy.ts  #   makes → models → generations → variants
│   │   ├── listings.ts  #   one table per vertical + shared facet columns
│   │   ├── analytics.ts #   lead_events, price_snapshots
│   │   ├── commerce.ts  #   ad packages, dealer plans, orders
│   │   └── trust.ts     #   inspections, reports, moderation log
│   └── seed/            # Phase 0 data: geography + vehicle catalogue
├── lib/
│   ├── seo/             # facet registry, indexation policy, JSON-LD
│   ├── listings/        # search, slugs, price-vs-market
│   └── format.ts        # PKR lacs/crore, phone normalization
├── components/
└── app/
    ├── used-cars/[[...segments]]/   # every car facet page
    ├── sitemap.ts                   # only indexable URLs with real inventory
    └── robots.ts
```

---

## Build order

Phases are sequenced so each one is useful on its own.

- [x] **Phase 0 — Taxonomy.** Geography, vehicle catalogue, part categories,
      features, packages. Boring, and everything depends on it.
- [x] **Phase 1a — Browse.** Facet routing, indexation policy, search queries,
      result cards, pagination, sitemap, robots.
- [x] **Phase 1b — The loop.** Phone OTP auth (hashed codes, rate limited,
      attempt-capped), session handling, listing wizard with cascading
      taxonomy, image upload with magic-byte validation, detail page with
      `Vehicle` JSON-LD, phone reveal wired to `lead_events`. *The MVP loop:
      post an ad → browse → search → contact seller.*
- [x] **Phase 2 — SEO surfaces.** All three verticals live on one shared
      route (`lib/routing/vertical.tsx`), internal-linking module that only
      ever points at indexable pages with real inventory, dealer storefronts,
      breadcrumbs and `Vehicle` / `AutoDealer` / `Service` JSON-LD.
- [x] **Phase 3a — Monetize.** Ad packages, JazzCash + Easypaisa hosted
      checkout, signed callbacks, promotions with bump credits.
- [x] **Phase 3b — Dealers.** Dealer signup, branded storefronts, bulk CSV
      import with per-row validation, subscription billing, lead analytics
      including the cold-listings panel.
- [x] **Phase 4 — Trust.** Inspection booking, listing reports, moderation
      queue with an append-only audit log, nightly price rollup and listing
      expiry via authenticated cron.
- [x] **Phase 5 — Adjacent.** Public price calculator, car finance EMI
      calculator with lead capture.

### Not built (deliberately)

- **Inspector field app and report PDFs.** Inspection *booking* exists; the
  operations side is a logistics build, not a web one.
- **Parts checkout.** Parts list and browse, but transact off-platform like
  every other listing. A cart and escrow is its own project.
- **Typesense.** Postgres handles search fine at this catalogue size. Swap
  when typo tolerance and instant results start mattering — the interface in
  `lib/listings/search.ts` is what you'd swap behind.

### Deliberate non-goals

**One frontend, not two.** The incumbent runs a server-rendered desktop site
and a separate React SPA for mobile web. Every feature ships twice and the two
drift. Responsive CSS costs a fraction of that.

**A performance budget, treated as a constraint:** under 150 KB of JS and
under 1.5s LCP on a mid-range Android over 4G. Default to server components;
a component becomes a client component only when it needs state or an event
handler. For reference, the incumbent's desktop home page ships 6,655 DOM
nodes, 407 images, 80 inline scripts and ~439 KB of JS — three GA properties,
two GTM containers, and an AddThis widget for a product discontinued in 2023.

**A real CSP from day one.** Retrofitting one is why most classifieds sites
never ship it at all.

---

## The parts that aren't code

Worth stating plainly, because they decide whether this works:

1. **Cold start.** No listings → no buyers → no listings. Seed supply by hand:
   sign up 50 dealers in one city, free forever, and bulk-import their
   inventory yourself.
2. **Don't fight the incumbent head-on.** Their moat is a two-decade backlink
   profile that cannot be bought. Win a wedge first — one city, or bikes only,
   or imports only — then expand.
3. **Fraud arrives with traction.** Curbstoning, price-bait, stolen vehicles.
   Phone verification, listing limits and a report queue need to exist before
   there is a problem, not after.
4. **Inspection is a logistics business.** Field inspectors, scheduling,
   travel. The software is the easy tenth of it — and it is also the highest
   margin thing in the model, and the reason buyers trust a listing at all.

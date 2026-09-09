# Performance and content review — 9 September 2026

## Changes

- Header account menus reuse the request-scoped session's administrator flag;
  two duplicate user queries per signed-in render were removed.
- Homepage previews fetch eight listings per category instead of 25, and skip
  the three unused total-count queries. Browse pagination retains exact counts.
- Browse results, filter options and session lookup start together.
- The logo declares its rendered width so image selection does not assume the
  original 1000px width.
- Listings and permissions remain live database reads; no shared user cache or
  stale listing cache was added.

## Content

Reviewed the public page templates, shared navigation/footer, listing display,
SEO title/description generation, legal/safety pages and form guidance. Rewrote
generic homepage copy and internal terminology in About, Contact and Sell My
Car Assistance. Corrected the dealer directory's empty state to describe the
verified-only result set.

Removed an unsupported `/search` structured-data action and a false claim in
vehicle offers that JaniWheels is the seller. Existing canonical and indexation
rules remain in place. Seller-written ads and dealer biographies are not
rewritten: their claims require verification by their authors. This is a
template-level review, not individual editorial approval of every database ad.

Editorial standard: use specific instructions, ordinary English and facts the
product supports. Avoid keyword repetition, invented credentials, fake reviews,
ranking guarantees and developer terminology in customer-facing copy.
Google's guidance prioritises useful, reliable content regardless of how it is
produced: https://developers.google.com/search/docs/fundamentals/creating-helpful-content

## Verification and limits

The full project checks, lint and production build passed. The earlier Node
`os.userInfo()` ENOMEM error did not recur outside the execution sandbox; it
was not evidence that the website or computer lacked RAM.

Development-mode initial requests measured 2.7–5.7 seconds across home, car,
bike, parts and About routes. Repeated requests measured 0.5–1.3 seconds.
Compilation makes these unsuitable as production performance targets.
Local server response timings exclude real mobile-network transfer and image
painting; staging Core Web Vitals and load tests remain required.

Final production sweep: 97 URLs, zero issues, including invalid routes and
signed-out redirects. After warm-up, local HTTP response times were 72–85ms
for home, 60–70ms for vehicle/parts browse and 18–21ms for About. These are
post-change production timings, not a controlled before/after speedup claim.
Maximum reported First Load JS remained 128KB. A trial global loading boundary
was removed after the sweep detected that it changed 404/redirect HTTP status.

The local production preview is running at http://127.0.0.1:3001 for review.
It represents the last build; development changes require a fresh build.

Next: review the changes, finish authenticated admin/dealer and populated
seller acceptance, enable Google Maps billing for map acceptance, then verify
production infrastructure and Search Console before launch.

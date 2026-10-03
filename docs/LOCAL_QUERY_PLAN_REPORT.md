# Local browse query-plan sample

Recorded 2026-10-03T02:56:24.495Z. Isolated PostgreSQL acceptance database,
10,000 synthetic active cars spread over ten cities, plus demo inventory.
All inserted fixtures rolled back. These are single-run warm local core-query
measurements, not full page timings, concurrency/load targets or production acceptance.

| Query | Execution ms | Returned rows | Shared buffer hits |
|---|---:|---:|---:|
| Recent cars | 0.077 | 25 | 5 |
| City and price | 0.103 | 25 | 26 |
| City count | 1.033 | 1 | 259 |

- Recent cars: Limit → Index Scan (listings_recent_idx)
- City and price: Limit → Incremental Sort → Index Scan (listings_city_idx)
- City count: Aggregate → Bitmap Heap Scan → Bitmap Index Scan (listings_city_idx)

Repeat with representative production volume/distribution on the chosen staging
host. Measure full browse joins, deep pagination, simultaneous requests, pool
pressure and Web Vitals before launch. Run the isolated script again after
index/query changes; never run fixture generation on production.

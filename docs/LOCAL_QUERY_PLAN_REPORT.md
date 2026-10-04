# Local browse query-plan sample

Recorded 2026-10-04T20:41:26.339Z. Isolated PostgreSQL acceptance database,
20,000 synthetic active cars/bikes/parts with one photo reference each, spread over ten cities, plus demo inventory.
All inserted fixtures rolled back. These are single-run warm local core-query
measurements, not full page timings, concurrency/load targets or production acceptance. Full browse joins and offsets 0/5,000 are included.

| Query | Execution ms | Returned rows | Shared buffer hits |
|---|---:|---:|---:|
| Recent cars | 0.123 | 25 | 5 |
| City and price | 0.695 | 25 | 19 |
| City count | 1.552 | 1 | 491 |
| car full browse joins, offset 0 | 151.66 | 25 | 764 |
| car optimized photo lookup, offset 0 | 2.447 | 25 | 69 |
| car full browse joins, offset 5000 | 198.3 | 25 | 764 |
| car optimized photo lookup, offset 5000 | 34.673 | 25 | 592 |
| bike full browse joins, offset 0 | 127.585 | 25 | 725 |
| bike optimized photo lookup, offset 0 | 1.361 | 25 | 66 |
| bike full browse joins, offset 5000 | 221.319 | 25 | 725 |
| bike optimized photo lookup, offset 5000 | 43.527 | 25 | 553 |
| part full browse joins, offset 0 | 142.832 | 25 | 724 |
| part optimized photo lookup, offset 0 | 1.564 | 25 | 67 |
| part full browse joins, offset 5000 | 141.014 | 25 | 724 |
| part optimized photo lookup, offset 5000 | 34.126 | 25 | 552 |

- Recent cars: Limit → Index Scan (listings_recent_idx)
- City and price: Limit → Incremental Sort → Index Scan (listings_city_idx)
- City count: Aggregate → Bitmap Heap Scan → Bitmap Index Scan (listings_city_idx)
- car full browse joins, offset 0: Limit → Sort → Hash Join → Hash Join → Hash Join → Hash Join → Hash Join → Hash Join → Aggregate → Seq Scan → Hash → Bitmap Heap Scan → Bitmap Index Scan (listings_price_idx) → Hash → Seq Scan → Hash → Seq Scan → Hash → Seq Scan → Hash → Seq Scan → Hash → Seq Scan
- car optimized photo lookup, offset 0: Sort → Hash Join → Hash Join → Hash Join → Seq Scan → Hash → Hash Join → Seq Scan → Hash → Merge Join → Index Scan (cities_pkey) → Sort → Subquery Scan → Limit → Index Scan (listings_recent_idx) → Hash → Seq Scan → Hash → Seq Scan → Aggregate → Index Scan (listing_images_listing_idx)
- car full browse joins, offset 5000: Limit → Sort → Hash Join → Hash Join → Hash Join → Hash Join → Hash Join → Hash Join → Aggregate → Seq Scan → Hash → Bitmap Heap Scan → Bitmap Index Scan (listings_price_idx) → Hash → Seq Scan → Hash → Seq Scan → Hash → Seq Scan → Hash → Seq Scan → Hash → Seq Scan
- car optimized photo lookup, offset 5000: Sort → Hash Join → Hash Join → Hash Join → Seq Scan → Hash → Hash Join → Seq Scan → Hash → Merge Join → Index Scan (cities_pkey) → Sort → Subquery Scan → Limit → Sort → Bitmap Heap Scan → Bitmap Index Scan (listings_price_idx) → Hash → Seq Scan → Hash → Seq Scan → Aggregate → Index Scan (listing_images_listing_idx)
- bike full browse joins, offset 0: Limit → Sort → Hash Join → Hash Join → Hash Join → Hash Join → Hash Join → Hash Join → Aggregate → Seq Scan → Hash → Bitmap Heap Scan → Bitmap Index Scan (listings_price_idx) → Hash → Seq Scan → Hash → Seq Scan → Hash → Seq Scan → Hash → Seq Scan → Hash → Seq Scan
- bike optimized photo lookup, offset 0: Sort → Hash Join → Hash Join → Hash Join → Seq Scan → Hash → Hash Join → Seq Scan → Hash → Merge Join → Index Scan (cities_pkey) → Sort → Subquery Scan → Limit → Index Scan (listings_recent_idx) → Hash → Seq Scan → Hash → Seq Scan → Aggregate → Index Scan (listing_images_listing_idx)
- bike full browse joins, offset 5000: Limit → Sort → Hash Join → Hash Join → Hash Join → Hash Join → Hash Join → Hash Join → Aggregate → Seq Scan → Hash → Bitmap Heap Scan → Bitmap Index Scan (listings_price_idx) → Hash → Seq Scan → Hash → Seq Scan → Hash → Seq Scan → Hash → Seq Scan → Hash → Seq Scan
- bike optimized photo lookup, offset 5000: Sort → Hash Join → Hash Join → Hash Join → Seq Scan → Hash → Hash Join → Seq Scan → Hash → Merge Join → Index Scan (cities_pkey) → Sort → Subquery Scan → Limit → Sort → Bitmap Heap Scan → Bitmap Index Scan (listings_price_idx) → Hash → Seq Scan → Hash → Seq Scan → Aggregate → Index Scan (listing_images_listing_idx)
- part full browse joins, offset 0: Limit → Sort → Hash Join → Hash Join → Hash Join → Hash Join → Hash Join → Hash Join → Aggregate → Seq Scan → Hash → Bitmap Heap Scan → Bitmap Index Scan (listings_price_idx) → Hash → Seq Scan → Hash → Seq Scan → Hash → Seq Scan → Hash → Seq Scan → Hash → Seq Scan
- part optimized photo lookup, offset 0: Sort → Hash Join → Hash Join → Hash Join → Seq Scan → Hash → Hash Join → Seq Scan → Hash → Merge Join → Index Scan (cities_pkey) → Sort → Subquery Scan → Limit → Index Scan (listings_recent_idx) → Hash → Seq Scan → Hash → Seq Scan → Aggregate → Index Scan (listing_images_listing_idx)
- part full browse joins, offset 5000: Limit → Sort → Hash Join → Hash Join → Hash Join → Hash Join → Hash Join → Hash Join → Aggregate → Seq Scan → Hash → Bitmap Heap Scan → Bitmap Index Scan (listings_price_idx) → Hash → Seq Scan → Hash → Seq Scan → Hash → Seq Scan → Hash → Seq Scan → Hash → Seq Scan
- part optimized photo lookup, offset 5000: Sort → Hash Join → Hash Join → Hash Join → Seq Scan → Hash → Hash Join → Seq Scan → Hash → Merge Join → Index Scan (cities_pkey) → Sort → Subquery Scan → Limit → Sort → Bitmap Heap Scan → Bitmap Index Scan (listings_price_idx) → Hash → Seq Scan → Hash → Seq Scan → Aggregate → Index Scan (listing_images_listing_idx)

Repeat with representative production volume/distribution on the chosen staging
host. Measure full browse joins, deep pagination, simultaneous requests, pool
pressure and Web Vitals before launch. Run the isolated script again after
index/query changes; never run fixture generation on production.

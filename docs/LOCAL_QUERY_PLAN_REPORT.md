# Local browse query-plan sample

Recorded 2026-10-13T02:50:57.137Z. Isolated PostgreSQL acceptance database,
20,000 synthetic active cars/bikes/parts with one photo reference each, spread over ten cities, plus demo inventory.
All inserted fixtures rolled back. These are single-run warm local core-query
measurements, not full page timings, concurrency/load targets or production acceptance. Full browse joins and offsets 0/5,000 are included.

| Query | Execution ms | Returned rows | Shared buffer hits |
|---|---:|---:|---:|
| Recent cars | 0.084 | 25 | 8 |
| City and price | 0.106 | 25 | 30 |
| City count | 0.559 | 1 | 487 |
| car full browse joins, offset 0 | 55.278 | 25 | 1035 |
| car optimized photo lookup, offset 0 | 0.566 | 25 | 94 |
| car full browse joins, offset 5000 | 77.612 | 25 | 1035 |
| car optimized photo lookup, offset 5000 | 20.535 | 25 | 594 |
| bike full browse joins, offset 0 | 62.673 | 25 | 974 |
| bike optimized photo lookup, offset 0 | 1.055 | 25 | 91 |
| bike full browse joins, offset 5000 | 61.126 | 25 | 974 |
| bike optimized photo lookup, offset 5000 | 9.562 | 25 | 555 |
| part full browse joins, offset 0 | 45.13 | 25 | 954 |
| part optimized photo lookup, offset 0 | 0.571 | 25 | 91 |
| part full browse joins, offset 5000 | 44.345 | 25 | 954 |
| part optimized photo lookup, offset 5000 | 9.108 | 25 | 561 |

- Recent cars: Limit → Index Scan (listings_recent_idx)
- City and price: Limit → Incremental Sort → Index Scan (listings_city_idx)
- City count: Aggregate → Bitmap Heap Scan → Bitmap Index Scan (listings_city_idx)
- car full browse joins, offset 0: Limit → Sort → Hash Join → Hash Join → Aggregate → Seq Scan → Hash → Merge Join → Nested Loop → Nested Loop → Nested Loop → Index Scan (listings_seller_idx) → Memoize → Index Scan (cities_pkey) → Memoize → Index Scan (makes_pkey) → Memoize → Index Scan (models_pkey) → Sort → Seq Scan → Hash → Seq Scan
- car optimized photo lookup, offset 0: Sort → Hash Join → Hash Join → Hash Join → Seq Scan → Hash → Hash Join → Seq Scan → Hash → Merge Join → Index Scan (cities_pkey) → Sort → Subquery Scan → Limit → Index Scan (listings_recent_idx) → Hash → Seq Scan → Hash → Seq Scan → Aggregate → Index Scan (listing_images_listing_idx)
- car full browse joins, offset 5000: Limit → Sort → Hash Join → Hash Join → Aggregate → Seq Scan → Hash → Merge Join → Nested Loop → Nested Loop → Nested Loop → Index Scan (listings_seller_idx) → Memoize → Index Scan (cities_pkey) → Memoize → Index Scan (makes_pkey) → Memoize → Index Scan (models_pkey) → Sort → Seq Scan → Hash → Seq Scan
- car optimized photo lookup, offset 5000: Sort → Hash Join → Hash Join → Hash Join → Seq Scan → Hash → Hash Join → Seq Scan → Hash → Merge Join → Index Scan (cities_pkey) → Sort → Subquery Scan → Limit → Sort → Bitmap Heap Scan → Bitmap Index Scan (listings_price_idx) → Hash → Seq Scan → Hash → Seq Scan → Aggregate → Index Scan (listing_images_listing_idx)
- bike full browse joins, offset 0: Limit → Sort → Hash Join → Hash Join → Hash Join → Hash Join → Aggregate → Seq Scan → Hash → Merge Join → Nested Loop → Index Scan (listings_seller_idx) → Memoize → Index Scan (models_pkey) → Sort → Seq Scan → Hash → Seq Scan → Hash → Seq Scan → Hash → Seq Scan
- bike optimized photo lookup, offset 0: Sort → Hash Join → Hash Join → Hash Join → Seq Scan → Hash → Hash Join → Seq Scan → Hash → Merge Join → Index Scan (cities_pkey) → Sort → Subquery Scan → Limit → Index Scan (listings_recent_idx) → Hash → Seq Scan → Hash → Seq Scan → Aggregate → Index Scan (listing_images_listing_idx)
- bike full browse joins, offset 5000: Limit → Sort → Hash Join → Hash Join → Hash Join → Hash Join → Aggregate → Seq Scan → Hash → Merge Join → Nested Loop → Index Scan (listings_seller_idx) → Memoize → Index Scan (models_pkey) → Sort → Seq Scan → Hash → Seq Scan → Hash → Seq Scan → Hash → Seq Scan
- bike optimized photo lookup, offset 5000: Sort → Hash Join → Hash Join → Hash Join → Seq Scan → Hash → Hash Join → Seq Scan → Hash → Merge Join → Index Scan (cities_pkey) → Sort → Subquery Scan → Limit → Sort → Bitmap Heap Scan → Bitmap Index Scan (listings_price_idx) → Hash → Seq Scan → Hash → Seq Scan → Aggregate → Index Scan (listing_images_listing_idx)
- part full browse joins, offset 0: Limit → Sort → Hash Join → Hash Join → Hash Join → Hash Join → Aggregate → Seq Scan → Hash → Merge Join → Nested Loop → Index Scan (listings_seller_idx) → Memoize → Index Scan (models_pkey) → Sort → Seq Scan → Hash → Seq Scan → Hash → Seq Scan → Hash → Seq Scan
- part optimized photo lookup, offset 0: Sort → Hash Join → Hash Join → Hash Join → Seq Scan → Hash → Hash Join → Seq Scan → Hash → Merge Join → Index Scan (cities_pkey) → Sort → Subquery Scan → Limit → Index Scan (listings_recent_idx) → Hash → Seq Scan → Hash → Seq Scan → Aggregate → Index Scan (listing_images_listing_idx)
- part full browse joins, offset 5000: Limit → Sort → Hash Join → Hash Join → Hash Join → Hash Join → Aggregate → Seq Scan → Hash → Merge Join → Nested Loop → Index Scan (listings_seller_idx) → Memoize → Index Scan (models_pkey) → Sort → Seq Scan → Hash → Seq Scan → Hash → Seq Scan → Hash → Seq Scan
- part optimized photo lookup, offset 5000: Sort → Hash Join → Hash Join → Hash Join → Seq Scan → Hash → Hash Join → Seq Scan → Hash → Merge Join → Index Scan (cities_pkey) → Sort → Subquery Scan → Limit → Sort → Bitmap Heap Scan → Bitmap Index Scan (listings_price_idx) → Hash → Seq Scan → Hash → Seq Scan → Aggregate → Index Scan (listing_images_listing_idx)

Repeat with representative production volume/distribution on the chosen staging
host. Measure full browse joins, deep pagination, simultaneous requests, pool
pressure and Web Vitals before launch. Run the isolated script again after
index/query changes; never run fixture generation on production.

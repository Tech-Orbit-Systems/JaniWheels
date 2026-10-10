import "dotenv/config";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";

const url = process.env.DATABASE_URL!;
if (!/(?:_test|_acceptance)$/.test(new URL(url).pathname)) throw new Error("Benchmark requires an isolated test database");
const sql = postgres(url, { max: 1 });
const cases: { name: string; milliseconds: number; rows: number; sharedHits: number; plan: string[] }[] = [];
const rollback = new Error("rollback benchmark fixtures");
try {
  await sql.begin(async tx => {
    await tx`SET LOCAL statement_timeout = '30s'`;
    const tag = randomUUID();
    const [owner] = await tx`INSERT INTO users (email) VALUES (${`benchmark-${tag}@example.invalid`}) RETURNING id`;
    const cities = await tx`SELECT id FROM cities ORDER BY id LIMIT 10`;
    if (cities.length < 10) throw new Error("Seed the acceptance database first");
    await tx`INSERT INTO listings (vertical,seller_id,slug,title,price_pkr,city_id,status,published_at,year)
      SELECT (CASE WHEN i%3=0 THEN 'car' WHEN i%3=1 THEN 'bike' ELSE 'part' END)::vertical,${owner.id},${tag}||'-'||i,'Synthetic benchmark listing',500000+(i%100)*100000,
      (${cities.map(city => city.id)}::int[])[1+(i%10)],'active',NOW()-(i||' minutes')::interval,2010+(i%15)
      FROM generate_series(1,20000) i`;
    await tx`INSERT INTO listing_images(listing_id,storage_key,position) SELECT id,'202610/'||md5(id::text||${tag})||'.webp',0 FROM listings WHERE seller_id=${owner.id}`;
    await tx`ANALYZE listings`;
    await tx`ANALYZE listing_images`;
    const plans: (readonly [string,postgres.RowList<postgres.Row[]>])[] = [
      ["Recent cars", await tx`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT id,slug,title,price_pkr FROM listings WHERE status='active' AND vertical='car' ORDER BY published_at DESC,id DESC LIMIT 25`],
      ["City and price", await tx`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT id,slug,title,price_pkr FROM listings WHERE status='active' AND vertical='car' AND city_id=${cities[0].id} AND price_pkr BETWEEN 1000000 AND 5000000 ORDER BY published_at DESC,id DESC LIMIT 25`],
      ["City count", await tx`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT count(*) FROM listings WHERE status='active' AND vertical='car' AND city_id=${cities[0].id}`],
    ];
    for (const vertical of ['car','bike','part']) for (const offset of [0,5000]) {
      plans.push([`${vertical} full browse joins, offset ${offset}`,await tx`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON)
        WITH primary_image AS (SELECT listing_id,MIN(storage_key) storage_key FROM listing_images WHERE position=0 GROUP BY listing_id)
        SELECT l.id,l.slug,l.title,l.price_pkr,l.year,l.mileage_km,c.name city_name,m.name make_name,mo.name model_name,u.type,d.business_name,p.storage_key
        FROM listings l JOIN cities c ON c.id=l.city_id JOIN users u ON u.id=l.seller_id
        LEFT JOIN dealers d ON d.id=l.dealer_id LEFT JOIN makes m ON m.id=l.make_id LEFT JOIN models mo ON mo.id=l.model_id LEFT JOIN primary_image p ON p.listing_id=l.id
        WHERE l.status='active' AND l.vertical=${vertical}::vertical ORDER BY l.published_at DESC,l.id DESC LIMIT 25 OFFSET ${offset}`]);
      plans.push([`${vertical} optimized photo lookup, offset ${offset}`,await tx`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON)
        WITH listing_page AS (SELECT * FROM listings WHERE status='active' AND vertical=${vertical}::vertical ORDER BY published_at DESC,id DESC LIMIT 25 OFFSET ${offset})
        SELECT l.id,l.slug,l.title,l.price_pkr,l.year,l.mileage_km,c.name city_name,m.name make_name,mo.name model_name,u.type,d.business_name,
          (SELECT MIN(storage_key) FROM listing_images WHERE listing_id=l.id AND position=0) storage_key
        FROM listing_page l JOIN cities c ON c.id=l.city_id JOIN users u ON u.id=l.seller_id
        LEFT JOIN dealers d ON d.id=l.dealer_id LEFT JOIN makes m ON m.id=l.make_id LEFT JOIN models mo ON mo.id=l.model_id
        ORDER BY l.published_at DESC,l.id DESC`]);
    }
    for (const [name, rows] of plans) {
      const result = rows[0]["QUERY PLAN"][0];
      const operations: string[] = [];
      interface PlanNode { [key: string]: unknown; Plans?: PlanNode[] }
      const walk = (node: PlanNode) => {
        operations.push(`${node["Node Type"]}${node["Index Name"] ? ` (${node["Index Name"]})` : ""}`);
        node.Plans?.forEach(walk);
      };
      walk(result.Plan);
      cases.push({ name, milliseconds: result["Execution Time"], rows: result.Plan["Actual Rows"], sharedHits: result.Plan["Shared Hit Blocks"], plan: operations });
    }
    throw rollback;
  });
} catch (error) {
  if (error !== rollback) throw error;
} finally { await sql.end(); }
const report = `# Local browse query-plan sample\n\nRecorded ${new Date().toISOString()}. Isolated PostgreSQL acceptance database,\n20,000 synthetic active cars/bikes/parts with one photo reference each, spread over ten cities, plus demo inventory.\nAll inserted fixtures rolled back. These are single-run warm local core-query\nmeasurements, not full page timings, concurrency/load targets or production acceptance. Full browse joins and offsets 0/5,000 are included.\n\n| Query | Execution ms | Returned rows | Shared buffer hits |\n|---|---:|---:|---:|\n${cases.map(c => `| ${c.name} | ${c.milliseconds} | ${c.rows} | ${c.sharedHits} |`).join("\n")}\n\n${cases.map(c => `- ${c.name}: ${c.plan.join(" → ")}`).join("\n")}\n\nRepeat with representative production volume/distribution on the chosen staging\nhost. Measure full browse joins, deep pagination, simultaneous requests, pool\npressure and Web Vitals before launch. Run the isolated script again after\nindex/query changes; never run fixture generation on production.\n`;
await writeFile("docs/LOCAL_QUERY_PLAN_REPORT.md", report);
console.log(JSON.stringify(cases));

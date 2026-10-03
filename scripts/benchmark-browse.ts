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
      SELECT 'car',${owner.id},${tag}||'-'||i,'Synthetic benchmark car',500000+(i%100)*100000,
      (${cities.map(city => city.id)}::int[])[1+(i%10)],'active',NOW()-(i||' minutes')::interval,2010+(i%15)
      FROM generate_series(1,10000) i`;
    await tx`ANALYZE listings`;
    const plans = [
      ["Recent cars", await tx`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT id,slug,title,price_pkr FROM listings WHERE status='active' AND vertical='car' ORDER BY published_at DESC,id DESC LIMIT 25`],
      ["City and price", await tx`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT id,slug,title,price_pkr FROM listings WHERE status='active' AND vertical='car' AND city_id=${cities[0].id} AND price_pkr BETWEEN 1000000 AND 5000000 ORDER BY published_at DESC,id DESC LIMIT 25`],
      ["City count", await tx`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT count(*) FROM listings WHERE status='active' AND vertical='car' AND city_id=${cities[0].id}`],
    ] as const;
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
const report = `# Local browse query-plan sample\n\nRecorded ${new Date().toISOString()}. Isolated PostgreSQL acceptance database,\n10,000 synthetic active cars spread over ten cities, plus demo inventory.\nAll inserted fixtures rolled back. These are single-run warm local core-query\nmeasurements, not full page timings, concurrency/load targets or production acceptance.\n\n| Query | Execution ms | Returned rows | Shared buffer hits |\n|---|---:|---:|---:|\n${cases.map(c => `| ${c.name} | ${c.milliseconds} | ${c.rows} | ${c.sharedHits} |`).join("\n")}\n\n${cases.map(c => `- ${c.name}: ${c.plan.join(" → ")}`).join("\n")}\n\nRepeat with representative production volume/distribution on the chosen staging\nhost. Measure full browse joins, deep pagination, simultaneous requests, pool\npressure and Web Vitals before launch. Run the isolated script again after\nindex/query changes; never run fixture generation on production.\n`;
await writeFile("docs/LOCAL_QUERY_PLAN_REPORT.md", report);
console.log(JSON.stringify(cases));

import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { consumeRateLimit } from "@/lib/security/rate-limit";

const databaseUrl = process.env.DATABASE_URL;
assert.ok(databaseUrl, "DATABASE_URL is required");
const databaseName = new URL(databaseUrl).pathname.slice(1);
assert.match(databaseName, /(?:_test|_acceptance)$/, "Run DB acceptance only on an isolated test database");
const sql = postgres(databaseUrl, { max: 1 });

test("migrations and curated reference data are present", async () => {
  const [counts] = await sql`
    SELECT
      (SELECT count(*)::int FROM cities) AS cities,
      (SELECT count(*)::int FROM makes) AS makes,
      (SELECT count(*)::int FROM models) AS models,
      (SELECT count(*)::int FROM variants) AS variants,
      (SELECT count(*)::int FROM part_categories) AS categories
  `;
  for (const [name, count] of Object.entries(counts)) {
    assert.ok(Number(count) > 0, `${name} must be seeded`);
  }
});

test("published demo listings cover cars, bikes and parts", async () => {
  const rows = await sql`
    SELECT vertical, count(*)::int AS count
    FROM listings WHERE status = 'active' AND seller_deleted_at IS NULL
    GROUP BY vertical
  `;
  const inventory = new Map(rows.map((row) => [row.vertical, row.count]));
  for (const vertical of ["car", "bike", "part"]) {
    assert.ok((inventory.get(vertical) ?? 0) > 0, `${vertical} inventory must exist`);
  }
});

test("vehicle facets agree with curated taxonomy", async () => {
  const [result] = await sql`
    SELECT count(*)::int AS mismatches
    FROM listings l
    JOIN variants v ON v.id = l.variant_id
    JOIN models m ON m.id = v.model_id
    JOIN makes k ON k.id = m.make_id
    WHERE l.vertical IN ('car', 'bike')
      AND (l.model_id <> m.id OR l.make_id <> k.id OR l.vertical <> k.vertical)
  `;
  assert.equal(result.mismatches, 0);
});

test("distributed rate limit counts simultaneous attempts atomically", async () => {
  const subject = randomUUID();
  const attempts = await Promise.all(Array.from({ length: 12 }, () =>
    consumeRateLimit({ scope: "acceptance", subject, max: 5, windowMs: 60_000 }),
  ));
  assert.equal(attempts.filter(Boolean).length, 5);
  assert.equal(attempts.filter((allowed) => !allowed).length, 7);
  assert.equal(await consumeRateLimit({ scope: "acceptance-other", subject, max: 1, windowMs: 60_000 }), true);
});

test.after(async () => { await sql.end(); });

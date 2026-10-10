import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";
import postgres from "postgres";
import { PAGE_SIZE, searchListings, type SortKey } from "@/lib/listings/search";
import type { FacetState, Vertical } from "@/lib/seo/facets";

const databaseUrl = process.env.DATABASE_URL;
assert.ok(databaseUrl, "DATABASE_URL is required");
assert.match(new URL(databaseUrl).pathname, /(?:_test|_acceptance)$/, "Search acceptance needs an isolated test database");
const sql = postgres(databaseUrl, { max: 1 });
test.after(async () => { await sql.end(); });

const fromPublic = `FROM listings l
  JOIN users u ON u.id=l.seller_id
  JOIN cities c ON c.id=l.city_id
  LEFT JOIN makes k ON k.id=l.make_id
  LEFT JOIN models m ON m.id=l.model_id
  LEFT JOIN provinces p ON p.id=c.province_id
  WHERE l.vertical=$1 AND l.status='active' AND l.seller_deleted_at IS NULL
    AND l.redacted_at IS NULL AND u.is_banned=false AND u.closed_at IS NULL
    AND u.anonymized_at IS NULL`;

type Case = { name: string; state: FacetState; clause: string; values: (string | number)[] };

async function expectedIds(vertical: Vertical, clause = "TRUE", values: (string | number)[] = [], order = "l.published_at DESC, l.id DESC") {
  // The independent SQL result is the acceptance oracle for IDs, count and order.
  const rows = await sql.unsafe(`SELECT l.id ${fromPublic} AND (${clause}) ORDER BY ${order}`, [vertical, ...values]);
  return rows.map(row => Number(row.id));
}

async function assertCase({ name, state, clause, values }: Case) {
  const expected = await expectedIds(state.vertical, clause, values);
  const actual = await searchListings(state);
  assert.ok(expected.length > 0, `${name}: seed must exercise a positive result`);
  assert.equal(actual.total, expected.length, `${name}: total`);
  assert.deepEqual(actual.rows.map(row => row.id), expected.slice(0, PAGE_SIZE), `${name}: exact first-page IDs`);
}

async function vehicleSeed(vertical: "car" | "bike") {
  const [row] = await sql.unsafe(`SELECT l.make_id, l.model_id, l.city_id, l.body_type::text body_type,
      l.transmission::text transmission, l.fuel::text fuel, l.assembly::text assembly,
      l.year, l.price_pkr, l.mileage_km, l.engine_cc,
      k.slug make_slug, k.name make_name, k.country_of_origin origin,
      m.slug model_slug, m.name model_name, c.slug city_slug, c.name city_name,
      p.id province_id, p.slug province_slug, p.name province_name, l.id
    ${fromPublic} AND l.model_id IS NOT NULL AND l.year IS NOT NULL
      AND l.mileage_km IS NOT NULL AND l.engine_cc IS NOT NULL
    ORDER BY l.id LIMIT 1`, [vertical]);
  assert.ok(row, `${vertical} seeded vehicle`);
  return row;
}

test("car facets and combinations return exact seeded IDs and counts", async () => {
  const r = await vehicleSeed("car");
  const base: FacetState = { vertical: "car" };
  const make = { id: r.make_id, slug: r.make_slug, name: r.make_name };
  const model = { id: r.model_id, slug: r.model_slug, name: r.model_name, makeSlug: r.make_slug };
  const city = { id: r.city_id, slug: r.city_slug, name: r.city_name };
  const province = { id: r.province_id, slug: r.province_slug, name: r.province_name };
  const cases: Case[] = [
    { name: "make", state: { ...base, make }, clause: "l.make_id=$2", values: [r.make_id] },
    { name: "model", state: { ...base, model }, clause: "l.model_id=$2", values: [r.model_id] },
    { name: "city", state: { ...base, city }, clause: "l.city_id=$2", values: [r.city_id] },
    { name: "province", state: { ...base, province }, clause: "c.province_id=$2", values: [r.province_id] },
    { name: "body", state: { ...base, bodyType: r.body_type }, clause: "l.body_type::text=$2", values: [r.body_type] },
    { name: "transmission", state: { ...base, transmission: r.transmission }, clause: "l.transmission::text=$2", values: [r.transmission] },
    { name: "fuel", state: { ...base, fuel: r.fuel }, clause: "l.fuel::text=$2", values: [r.fuel] },
    { name: "assembly", state: { ...base, assembly: r.assembly }, clause: "l.assembly::text=$2", values: [r.assembly] },
    { name: "origin", state: { ...base, origin: r.origin }, clause: "k.country_of_origin=$2", values: [r.origin] },
    { name: "year bounds", state: { ...base, year: { min: r.year, max: r.year } }, clause: "l.year BETWEEN $2 AND $3", values: [r.year, r.year] },
    { name: "price bounds", state: { ...base, price: { min: r.price_pkr, max: r.price_pkr } }, clause: "l.price_pkr BETWEEN $2 AND $3", values: [r.price_pkr, r.price_pkr] },
    { name: "mileage bounds", state: { ...base, mileage: { min: r.mileage_km, max: r.mileage_km } }, clause: "l.mileage_km BETWEEN $2 AND $3", values: [r.mileage_km, r.mileage_km] },
    { name: "engine bounds", state: { ...base, engine: { min: r.engine_cc, max: r.engine_cc } }, clause: "l.engine_cc BETWEEN $2 AND $3", values: [r.engine_cc, r.engine_cc] },
    { name: "combined car facets", state: { ...base, model, city, bodyType: r.body_type, transmission: r.transmission, fuel: r.fuel, assembly: r.assembly, price: { min: r.price_pkr, max: r.price_pkr } }, clause: "l.model_id=$2 AND l.city_id=$3 AND l.body_type::text=$4 AND l.transmission::text=$5 AND l.fuel::text=$6 AND l.assembly::text=$7 AND l.price_pkr BETWEEN $8 AND $9", values: [r.model_id, r.city_id, r.body_type, r.transmission, r.fuel, r.assembly, r.price_pkr, r.price_pkr] },
  ];
  const features = await sql`SELECT f.slug FROM listing_features lf JOIN features f ON f.id=lf.feature_id WHERE lf.listing_id=${r.id} ORDER BY f.slug LIMIT 2`;
  assert.equal(features.length, 2, "seed should exercise feature intersection");
  const featureSlugs = features.map(row => String(row.slug));
  cases.push({ name: "both requested features", state: { ...base, feature: featureSlugs }, clause: "EXISTS (SELECT 1 FROM listing_features lf JOIN features f ON f.id=lf.feature_id WHERE lf.listing_id=l.id AND f.slug=$2) AND EXISTS (SELECT 1 FROM listing_features lf JOIN features f ON f.id=lf.feature_id WHERE lf.listing_id=l.id AND f.slug=$3)", values: featureSlugs });
  for (const item of cases) await assertCase(item);
  const noMatch = await searchListings({ ...base, year: { min: 1900, max: 1900 } });
  assert.equal(noMatch.total, 0);
  assert.deepEqual(noMatch.rows, []);
});

test("bike facets and combinations return exact seeded IDs and counts", async () => {
  const r = await vehicleSeed("bike");
  const base: FacetState = { vertical: "bike" };
  const make = { id: r.make_id, slug: r.make_slug, name: r.make_name };
  const model = { id: r.model_id, slug: r.model_slug, name: r.model_name, makeSlug: r.make_slug };
  const city = { id: r.city_id, slug: r.city_slug, name: r.city_name };
  const province = { id: r.province_id, slug: r.province_slug, name: r.province_name };
  const cases: Case[] = [
    { name: "bike make", state: { ...base, make }, clause: "l.make_id=$2", values: [r.make_id] },
    { name: "bike model", state: { ...base, model }, clause: "l.model_id=$2", values: [r.model_id] },
    { name: "bike city", state: { ...base, city }, clause: "l.city_id=$2", values: [r.city_id] },
    { name: "bike province", state: { ...base, province }, clause: "c.province_id=$2", values: [r.province_id] },
    { name: "bike fuel", state: { ...base, fuel: r.fuel }, clause: "l.fuel::text=$2", values: [r.fuel] },
    { name: "bike year", state: { ...base, year: { min: r.year, max: r.year } }, clause: "l.year BETWEEN $2 AND $3", values: [r.year, r.year] },
    { name: "bike price", state: { ...base, price: { min: r.price_pkr, max: r.price_pkr } }, clause: "l.price_pkr BETWEEN $2 AND $3", values: [r.price_pkr, r.price_pkr] },
    { name: "bike mileage", state: { ...base, mileage: { min: r.mileage_km, max: r.mileage_km } }, clause: "l.mileage_km BETWEEN $2 AND $3", values: [r.mileage_km, r.mileage_km] },
    { name: "bike engine", state: { ...base, engine: { min: r.engine_cc, max: r.engine_cc } }, clause: "l.engine_cc BETWEEN $2 AND $3", values: [r.engine_cc, r.engine_cc] },
    { name: "combined bike facets", state: { ...base, model, city, fuel: r.fuel, year: { min: r.year, max: r.year }, price: { min: r.price_pkr, max: r.price_pkr } }, clause: "l.model_id=$2 AND l.city_id=$3 AND l.fuel::text=$4 AND l.year=$5 AND l.price_pkr=$6", values: [r.model_id, r.city_id, r.fuel, r.year, r.price_pkr] },
  ];
  for (const item of cases) await assertCase(item);
});

test("every sort and three pages preserve exact order without duplicates", async () => {
  const orders: Record<SortKey, string> = {
    recent: "l.published_at DESC, l.id DESC",
    price_asc: "l.price_pkr ASC, l.id DESC",
    price_desc: "l.price_pkr DESC, l.id DESC",
    year_desc: "l.year DESC, l.id DESC",
    year_asc: "l.year ASC, l.id DESC",
    mileage_asc: "l.mileage_km ASC, l.id DESC",
  };
  for (const vertical of ["car", "bike", "part"] as const) {
    for (const [sort, order] of Object.entries(orders) as [SortKey, string][]) {
      if (vertical === "part" && ["year_desc", "year_asc", "mileage_asc"].includes(sort)) continue;
      const ids = await expectedIds(vertical, "TRUE", [], order);
      assert.ok(ids.length > PAGE_SIZE * 2, `${vertical}/${sort} needs over 50 seeded rows`);
      const seen = new Set<number>();
      for (const page of [1, 2, 3]) {
        const result = await searchListings({ vertical, sort, page });
        const actual = result.rows.map(row => row.id);
        assert.equal(result.total, ids.length, `${vertical}/${sort} total`);
        assert.equal(result.pageCount, Math.ceil(ids.length / PAGE_SIZE), `${vertical}/${sort} page count`);
        assert.deepEqual(actual, ids.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), `${vertical}/${sort} page ${page}`);
        for (const id of actual) { assert.ok(!seen.has(id), `${vertical}/${sort} duplicate ${id}`); seen.add(id); }
      }
    }
  }
});

import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { db } from "@/db";
import { claimUploadedImages, UploadOwnershipError } from "@/lib/images/ownership";
import { ListingInputError, publishBikeListing, publishCarListing, publishPartListing } from "@/lib/listings/publish";
import { bikeListingSchema, carListingSchema, partListingSchema } from "@/lib/listings/validation";
import { ListingQuotaError } from "@/lib/listings/quota";

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

test("upload claims enforce ownership and roll back a partially matched batch", async () => {
  const fixture = randomUUID();
  const owners = await sql`INSERT INTO users (email) VALUES
    (${`upload-owner-${fixture}@example.invalid`}), (${`upload-other-${fixture}@example.invalid`}) RETURNING id`;
  const [city] = await sql`SELECT id FROM cities ORDER BY id LIMIT 1`;
  const [listing] = await sql`INSERT INTO listings (vertical, seller_id, slug, title, price_pkr, city_id, status)
    VALUES ('part', ${owners[0].id}, 'upload-claim-fixture', 'Upload claim fixture', 2500, ${city.id}, 'draft') RETURNING id`;
  const ownKey = `own-${fixture}.webp`;
  const otherKey = `other-${fixture}.webp`;

  try {
    await sql`INSERT INTO pending_uploads (storage_key, user_id, bytes) VALUES
      (${ownKey}, ${owners[0].id}, 100), (${otherKey}, ${owners[1].id}, 100)`;
    await assert.rejects(
      db.transaction((tx) => claimUploadedImages(tx, owners[0].id, listing.id, [ownKey, otherKey])),
      UploadOwnershipError,
    );
    const unchanged = await sql`SELECT listing_id, claimed_at FROM pending_uploads WHERE storage_key IN (${ownKey}, ${otherKey})`;
    assert.equal(unchanged.length, 2);
    assert.ok(unchanged.every((row) => row.listing_id === null && row.claimed_at === null), "The valid key must also roll back when the other key belongs to another user");
    await assert.rejects(
      db.transaction((tx) => claimUploadedImages(tx, owners[0].id, listing.id, [ownKey, ownKey])),
      UploadOwnershipError,
    );

    await db.transaction((tx) => claimUploadedImages(tx, owners[0].id, listing.id, [ownKey]));
    const [claimed] = await sql`SELECT listing_id, claimed_at FROM pending_uploads WHERE storage_key = ${ownKey}`;
    assert.equal(claimed.listing_id, listing.id);
    assert.ok(claimed.claimed_at);
    await assert.rejects(
      db.transaction((tx) => claimUploadedImages(tx, owners[0].id, listing.id, [ownKey])),
      UploadOwnershipError,
    );
    const [foreign] = await sql`SELECT listing_id, claimed_at FROM pending_uploads WHERE storage_key = ${otherKey}`;
    assert.equal(foreign.listing_id, null);
    assert.equal(foreign.claimed_at, null);
  } finally {
    await sql`DELETE FROM pending_uploads WHERE storage_key IN (${ownKey}, ${otherKey})`;
    await sql`DELETE FROM listings WHERE id = ${listing.id}`;
    await sql`DELETE FROM users WHERE id IN (${owners[0].id}, ${owners[1].id})`;
  }
});

test("publication rejects foreign taxonomy and cross-city areas before claiming photos", async () => {
  const tag = randomUUID();
  const [owner] = await sql`INSERT INTO users(email) VALUES (${tag+'@example.invalid'}) RETURNING id`;
  const [area] = await sql`SELECT id,city_id FROM areas ORDER BY id LIMIT 1`;
  const [city] = await sql`SELECT id FROM cities WHERE id<>${area.city_id} ORDER BY id LIMIT 1`;
  const [car] = await sql`SELECT v.id FROM variants v JOIN models m ON m.id=v.model_id JOIN makes k ON k.id=m.make_id WHERE k.vertical='car' AND v.is_active AND m.is_active AND k.is_active LIMIT 1`;
  const [bike] = await sql`SELECT v.id FROM variants v JOIN models m ON m.id=v.model_id JOIN makes k ON k.id=m.make_id WHERE k.vertical='bike' AND v.fuel<>'electric' AND v.is_active AND m.is_active AND k.is_active LIMIT 1`;
  const [category] = await sql`SELECT p.id FROM part_categories p WHERE NOT EXISTS(SELECT 1 FROM part_categories c WHERE c.parent_id=p.id) LIMIT 1`;
  const key = `202610/${tag.replaceAll('-','')}.webp`;
  const carInput = carListingSchema.parse({variantId:car.id,cityId:city.id,areaId:area.id,year:2020,pricePkr:900000,mileageKm:1200,assembly:'local',imageKeys:[key]});
  const bikeInput = bikeListingSchema.parse({variantId:bike.id,cityId:city.id,areaId:area.id,year:2020,pricePkr:250000,mileageKm:1200,assembly:'local',bikeType:'motorcycle',condition:'used',isElectric:false,ignitionType:'kick-and-self',engineType:'four-stroke',numberOfGears:4,imageKeys:[key]});
  const partInput = partListingSchema.parse({categoryId:category.id,cityId:city.id,areaId:area.id,brand:'Denso',condition:'new',partOrigin:'genuine-oem',priceUnit:'piece',stockQty:1,deliveryOption:'pickup',pricePkr:5000,imageKeys:[key]});
  try {
    await sql`INSERT INTO pending_uploads(storage_key,user_id,bytes) VALUES (${key},${owner.id},100)`;
    await assert.rejects(publishCarListing(owner.id,{...carInput,variantId:bike.id}),error=>error instanceof ListingInputError && error.field==='variantId');
    await assert.rejects(publishCarListing(owner.id,{...carInput,variantId:2147483647,customMakeName:'Custom',customModelName:'Model'}),error=>error instanceof ListingInputError && error.field==='variantId');
    for (const attempt of [()=>publishCarListing(owner.id,carInput),()=>publishBikeListing(owner.id,bikeInput),()=>publishPartListing(owner.id,partInput)]) {
      await assert.rejects(attempt,error=>error instanceof ListingInputError && error.field==='areaId');
    }
    assert.equal((await sql`SELECT count(*)::int n FROM listings WHERE seller_id=${owner.id}`)[0].n,0);
    assert.equal((await sql`SELECT claimed_at FROM pending_uploads WHERE storage_key=${key}`)[0].claimed_at,null);
    await publishCarListing(owner.id,{...carInput,cityId:area.city_id});
    assert.equal((await sql`SELECT area_id FROM listings WHERE seller_id=${owner.id}`)[0].area_id,area.id);
  } finally {
    await sql`DELETE FROM pending_uploads WHERE user_id=${owner.id}`;
    await sql`DELETE FROM listings WHERE seller_id=${owner.id}`;
    await sql`DELETE FROM users WHERE id=${owner.id}`;
  }
});

test("concurrent mixed-vertical publication cannot exceed the individual quota", async () => {
  const tag = randomUUID();
  const [owner] = await sql`INSERT INTO users(email) VALUES (${tag+'@example.invalid'}) RETURNING id`;
  const [city] = await sql`SELECT id FROM cities LIMIT 1`;
  const [category] = await sql`SELECT p.id FROM part_categories p WHERE NOT EXISTS(SELECT 1 FROM part_categories c WHERE c.parent_id=p.id) LIMIT 1`;
  const keys = Array.from({length:5},()=>`202610/${randomUUID().replaceAll('-','')}.webp`);
  const input = partListingSchema.parse({categoryId:category.id,cityId:city.id,brand:'Denso',condition:'new',partOrigin:'genuine-oem',priceUnit:'piece',stockQty:1,deliveryOption:'pickup',pricePkr:5000,imageKeys:[keys[0]]});
  try {
    await sql`INSERT INTO listings(vertical,seller_id,slug,title,price_pkr,city_id,status) VALUES
      ('car',${owner.id},${tag+'-car'},'Quota car',900000,${city.id},'active'),
      ('bike',${owner.id},${tag+'-bike'},'Quota bike',250000,${city.id},'pending_review')`;
    for (const key of keys) await sql`INSERT INTO pending_uploads(storage_key,user_id,bytes) VALUES (${key},${owner.id},100)`;
    const results = await Promise.allSettled(keys.slice(0,3).map(key=>publishPartListing(owner.id,{...input,imageKeys:[key]})));
    assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
    assert.ok(results.filter(result=>result.status==='rejected').every(result=>result.status==='rejected' && result.reason instanceof ListingQuotaError));
    assert.equal((await sql`SELECT count(*)::int n FROM listings WHERE seller_id=${owner.id} AND status IN ('active','pending_review')`)[0].n,3);
    const [dealer] = await sql`INSERT INTO dealers(user_id,business_name,slug,city_id) VALUES (${owner.id},'Quota dealer',${tag},${city.id}) RETURNING id`;
    for (const key of keys.slice(3)) await publishPartListing(owner.id,{...input,imageKeys:[key]},{dealerId:dealer.id,publisher:'unverified_dealer'});
    assert.equal((await sql`SELECT count(*)::int n FROM listings WHERE seller_id=${owner.id}`)[0].n,5);
  } finally {
    await sql`DELETE FROM pending_uploads WHERE user_id=${owner.id}`;
    await sql`DELETE FROM listings WHERE seller_id=${owner.id}`;
    await sql`DELETE FROM dealers WHERE user_id=${owner.id}`;
    await sql`DELETE FROM users WHERE id=${owner.id}`;
  }
});

test.after(async () => { await sql.end(); });

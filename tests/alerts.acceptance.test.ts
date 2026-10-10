import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { queueSavedSearchAlerts, deliverSavedSearchAlerts } from "@/lib/buyer/alerts";
import type { AlertEmail } from "@/lib/email/saved-search";

test("banned listing owners cannot match or deliver alerts to a different buyer", async () => {
  const url = process.env.DATABASE_URL!;
  assert.match(new URL(url).pathname, /(?:_test|_acceptance)$/);
  const sql = postgres(url, {max:2});
  const tag = randomUUID();
  process.env.EMAIL_FROM = "JaniWheels <alerts@example.invalid>";
  const [seller] = await sql`INSERT INTO users(email,is_banned) VALUES (${tag+'-seller@example.invalid'},true) RETURNING id`;
  const [buyer] = await sql`INSERT INTO users(email,email_verified_at) VALUES (${tag+'-buyer@example.invalid'},NOW()) RETURNING id`;
  try {
    const [city] = await sql`SELECT id FROM cities LIMIT 1`;
    const [listing] = await sql`INSERT INTO listings(vertical,seller_id,slug,title,price_pkr,city_id,status,published_at) VALUES ('part',${seller.id},${tag},${tag},2500,${city.id},'active',NOW()) RETURNING id`;
    const [search] = await sql`INSERT INTO saved_searches(user_id,name,vertical,filters,alert_frequency) VALUES (${buyer.id},'Ban acceptance','part',${sql.json({state:{vertical:'part',keyword:tag}})},'instant') RETURNING id`;
    await queueSavedSearchAlerts();
    assert.equal((await sql`SELECT count(*)::int n FROM saved_search_notifications WHERE saved_search_id=${search.id}`)[0].n,0);
    await sql`UPDATE users SET is_banned=false WHERE id=${seller.id}`;
    await sql`UPDATE saved_searches SET last_notified_at=NULL WHERE id=${search.id}`;
    await queueSavedSearchAlerts();
    assert.equal((await sql`SELECT count(*)::int n FROM saved_search_notifications WHERE saved_search_id=${search.id}`)[0].n,1);
    await sql`UPDATE users SET is_banned=true WHERE id=${seller.id}`;
    let sent=0;
    await deliverSavedSearchAlerts(async(payload)=>{if(payload.to.includes(tag+'-buyer@example.invalid')) sent++;},25);
    assert.equal(sent,0);
    assert.ok((await sql`SELECT suppressed_at FROM saved_search_notifications WHERE saved_search_id=${search.id} AND listing_id=${listing.id}`)[0].suppressed_at);
  } finally {
    await sql`DELETE FROM saved_searches WHERE user_id=${buyer.id}`;
    await sql`DELETE FROM listings WHERE seller_id=${seller.id}`;
    await sql`DELETE FROM users WHERE id IN (${seller.id},${buyer.id})`;
    await sql.end();
  }
});

test("saved alerts drain overflow, deduplicate, retry immutably and honor opt-out", async () => {
  const url = process.env.DATABASE_URL!;
  assert.match(new URL(url).pathname, /(?:_test|_acceptance)$/);
  const sql = postgres(url, { max: 2 });
  const tag = randomUUID();
  const [owner] = await sql`INSERT INTO users (email,email_verified_at) VALUES (${`alerts-${tag}@example.invalid`},NOW()) RETURNING id,email`;
  process.env.EMAIL_FROM = "JaniWheels <alerts@example.invalid>";
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3101";
  try {
    const [city] = await sql`SELECT id FROM cities LIMIT 1`;
    await sql`INSERT INTO listings (vertical,seller_id,slug,title,price_pkr,city_id,status,published_at)
      SELECT 'part',${owner.id},${tag}||'-'||i,${tag}||' item '||i,2500,${city.id},'active',NOW() FROM generate_series(1,105) i`;
    const [search] = await sql`INSERT INTO saved_searches (user_id,name,vertical,filters,alert_frequency)
      VALUES (${owner.id},'Acceptance search','part',${sql.json({ state: { vertical: "part", keyword: tag } })},'daily') RETURNING id`;
    await Promise.all([queueSavedSearchAlerts(), queueSavedSearchAlerts()]);
    await queueSavedSearchAlerts();
    const [count] = await sql`SELECT count(*)::int n FROM saved_search_notifications WHERE saved_search_id=${search.id}`;
    assert.equal(count.n, 105);
    await queueSavedSearchAlerts();
    assert.equal((await sql`SELECT count(*)::int n FROM saved_search_notifications WHERE saved_search_id=${search.id}`)[0].n, 105);
    const [marker] = await sql`SELECT last_notified_at FROM saved_searches WHERE id=${search.id}`;
    assert.ok(marker.last_notified_at);

    let firstPayload: AlertEmail | undefined;
    let firstKey = "";
    const failure = await deliverSavedSearchAlerts(async (payload, key) => { firstPayload = payload; firstKey = key; throw new Error("provider unavailable"); }, 1);
    assert.equal(failure.failed, 1);
    assert.match(firstKey, /^saved-search-[a-f0-9-]{36}$/);
    const [failed] = await sql`SELECT * FROM saved_search_notifications WHERE saved_search_id=${search.id} AND payload->>'key'=${firstKey}`;
    const firstId = failed.id;
    assert.equal(failed.delivered, false);
    assert.equal(failed.attempts, 1);
    assert.ok(failed.first_attempt_at && failed.next_attempt_at > new Date());
    await sql`UPDATE listings SET title='Changed after first send attempt' WHERE id=${failed.listing_id}`;
    // Give the retry a past due time across PostgreSQL and JavaScript clock precision.
    await sql`UPDATE saved_search_notifications SET next_attempt_at=NOW()-INTERVAL '1 second' WHERE id=${firstId}`;
    await deliverSavedSearchAlerts(async (payload, key) => { assert.equal(key, firstKey); assert.deepEqual(payload, firstPayload); }, 1);
    assert.equal((await sql`SELECT delivered FROM saved_search_notifications WHERE id=${firstId}`)[0].delivered, true);

    const keys = new Set<string>();
    await Promise.all([1, 2].map(() => deliverSavedSearchAlerts(async (_payload, key) => {
      assert.ok(!keys.has(key)); keys.add(key);
    }, 10)));
    assert.equal(keys.size, 20);
    await sql`UPDATE saved_searches SET alert_frequency='off' WHERE id=${search.id}`;
    let sent = 0;
    const stopped = await deliverSavedSearchAlerts(async () => { sent++; }, 1);
    assert.equal(stopped.suppressed, 1);
    assert.equal(sent, 0);
    await sql`UPDATE saved_searches SET alert_frequency='instant' WHERE id=${search.id}`;
    await sql`UPDATE saved_search_notifications SET first_attempt_at=NOW()-INTERVAL '25 hours' WHERE saved_search_id=${search.id} AND delivered=false AND suppressed_at IS NULL`;
    const expired = await deliverSavedSearchAlerts(async () => { sent++; }, 1);
    assert.equal(expired.suppressed, 1);
    assert.equal(sent, 0);
    await sql`UPDATE saved_search_notifications SET first_attempt_at=NULL WHERE saved_search_id=${search.id} AND delivered=false AND suppressed_at IS NULL`;
    await sql`UPDATE users SET is_banned=true WHERE id=${owner.id}`;
    assert.equal((await deliverSavedSearchAlerts(async () => { sent++; }, 1)).suppressed, 1);
    assert.equal(sent, 0);
    await sql`UPDATE users SET is_banned=false,email='changed@example.invalid' WHERE id=${owner.id}`;
    assert.equal((await deliverSavedSearchAlerts(async () => { sent++; }, 1)).suppressed, 1);
    assert.equal(sent, 0);
  } finally {
    await sql`DELETE FROM saved_searches WHERE user_id=${owner.id}`;
    await sql`DELETE FROM listings WHERE seller_id=${owner.id}`;
    await sql`DELETE FROM users WHERE id=${owner.id}`;
    await sql.end();
  }
});

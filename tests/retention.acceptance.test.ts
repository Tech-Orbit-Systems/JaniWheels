import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { earlyDeletion, closeAccount, restoreAccount, createHold, reviewHold, runRetention, drainMediaDeletions, exportLedger, replayLedger } from "../src/lib/retention/core";
import { incrementViewCount } from "../src/lib/listings/detail";

const url = process.env.DATABASE_URL!;
assert.match(new URL(url).pathname, /(?:_test|_acceptance)$/);

test("view count and account closure serialize without a seller/listing deadlock", async () => {
  const sql = postgres(url,{max:5});
  const tag = randomUUID();
  const [city] = await sql`SELECT id FROM cities LIMIT 1`;
  const [owner] = await sql`INSERT INTO users(email) VALUES (${tag+'@example.invalid'}) RETURNING id`;
  const [listing] = await sql`INSERT INTO listings(vertical,seller_id,slug,title,price_pkr,city_id,status)
    VALUES ('part',${owner.id},${tag},'Counter lock fixture',2500,${city.id},'active') RETURNING id`;
  let release!:()=>void;
  let ready!:()=>void;
  const held=new Promise<void>(resolve=>{ready=resolve;});
  const gate=new Promise<void>(resolve=>{release=resolve;});
  const blocker=sql.begin(async tx=>{
    await tx`SELECT id FROM listings WHERE id=${listing.id} FOR UPDATE`;
    ready();
    await gate;
  });
  async function waitBlocked(fragment:string) {
    for(let attempt=0;attempt<100;attempt++) {
      const [row]=await sql`SELECT count(*)::int n FROM pg_stat_activity
        WHERE datname=current_database() AND wait_event_type='Lock' AND query ILIKE ${'%'+fragment+'%'}`;
      if(row.n>0) return;
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    throw new Error(`Expected blocked ${fragment} transaction`);
  }
  try {
    await held;
    const count=incrementViewCount(listing.id);
    await waitBlocked('view_count');
    const closure=closeAccount(sql,owner.id);
    try {
      await waitBlocked('seller_id=%FOR UPDATE');
    } finally { release(); }
    const results=await Promise.allSettled([count,closure,blocker]);
    assert.ok(results.every(result=>result.status==='fulfilled'),JSON.stringify(results));
    const [final]=await sql`SELECT status,view_count FROM listings WHERE id=${listing.id}`;
    assert.equal(final.status,'removed');
    assert.equal(final.view_count,1);
  } finally {
    release();
    await blocker.catch(()=>{});
    await sql`DELETE FROM retention_receipts WHERE resource='account' AND resource_id=${owner.id}`;
    await sql`DELETE FROM listings WHERE id=${listing.id}`;
    await sql`DELETE FROM users WHERE id=${owner.id}`;
    await sql.end();
  }
});

test("approved retention respects recovery, holds, cutoff, retries and restore replay", async () => {
  const sql = postgres(url,{max:3});
  const tag = randomUUID();
  const [city] = await sql`SELECT id FROM cities LIMIT 1`;
  const [owner] = await sql`INSERT INTO users(name,email,password_hash,email_verified_at,avatar_url) VALUES ('Retention owner',${tag+'@example.invalid'},'test-hash',NOW(),${`202610/${tag.replaceAll('-','').slice(0,32)}.webp`}) RETURNING id`;
  const [admin] = await sql`INSERT INTO users(email,is_admin) VALUES (${tag+'-admin@example.invalid'},true) RETURNING id`;
  const [listing] = await sql`INSERT INTO listings(vertical,seller_id,slug,title,description,price_pkr,city_id,status,published_at,expires_at)
    VALUES ('part',${owner.id},${tag},'Phone in title','private seller description',2500,${city.id},'active',NOW(),NOW()+INTERVAL '1 day') RETURNING id`;
  const [search] = await sql`INSERT INTO saved_searches(user_id,filters,vertical,alert_frequency) VALUES (${owner.id},'{}','part','daily') RETURNING id`;
  try {
    await sql`INSERT INTO sessions(id,user_id,expires_at) VALUES (${tag},${owner.id},NOW()+INTERVAL '1 day')`;
    await assert.rejects(closeAccount(sql,admin.id),/handover/);
    await Promise.all([closeAccount(sql,owner.id),closeAccount(sql,owner.id)]);
    assert.equal((await sql`SELECT count(*)::int n FROM sessions WHERE user_id=${owner.id}`)[0].n,0);
    assert.equal((await sql`SELECT status FROM listings WHERE id=${listing.id}`)[0].status,'removed');
    assert.equal((await sql`SELECT alert_frequency FROM saved_searches WHERE id=${search.id}`)[0].alert_frequency,'off');
    await assert.rejects(sql`INSERT INTO sessions(id,user_id,expires_at) VALUES (${tag},${owner.id},NOW()+INTERVAL '1 day')`,/recovery sessions/);
    await sql`INSERT INTO sessions(id,user_id,expires_at,recovery_only) VALUES (${tag},${owner.id},NOW()+INTERVAL '1 day',true)`;
    await assert.rejects(sql`UPDATE listings SET status='active' WHERE id=${listing.id}`,/Closed account/);
    await assert.rejects(sql`UPDATE users SET name='changed' WHERE id=${owner.id}`,/Closed account/);
    const [closure] = await sql`SELECT u.closure_state,u.closed_at::text AS closed_text,l.updated_at::text AS updated_text,l.updated_at=u.closed_at AS same FROM users u JOIN listings l ON l.seller_id=u.id WHERE u.id=${owner.id}`;
    assert.equal(closure.closure_state.listings[0].status,'active');
    assert.equal(closure.same,true,JSON.stringify({closed:closure.closed_text,updated:closure.updated_text}));
    await restoreAccount(sql,owner.id);
    assert.equal((await sql`SELECT status FROM listings WHERE id=${listing.id}`)[0].status,'active');
    assert.equal((await sql`SELECT alert_frequency FROM saved_searches WHERE id=${search.id}`)[0].alert_frequency,'daily');

    await closeAccount(sql,owner.id);
    // An administrator's later decision must survive restoration.
    await sql`UPDATE listings SET status='rejected',updated_at=NOW() WHERE id=${listing.id}`;
    await restoreAccount(sql,owner.id);
    assert.equal((await sql`SELECT status FROM listings WHERE id=${listing.id}`)[0].status,'rejected');
    await closeAccount(sql,owner.id);
    await sql`UPDATE users SET closed_at=NOW()-INTERVAL '31 days' WHERE id=${owner.id}`;
    await assert.rejects(restoreAccount(sql,owner.id),/recovery period/);
    await assert.rejects(createHold(sql,'account',owner.id,'Open complaint', 'Operator', owner.id),/Administrator/);
    const hold = await createHold(sql,'account',owner.id,'Identity needed for complaint','Operator',admin.id);
    await sql`UPDATE retention_holds SET reviewed_at=NOW()-INTERVAL '91 days' WHERE id=${hold}`;
    const before = (await sql`SELECT name,email FROM users WHERE id=${owner.id}`)[0];
    const preview = await runRetention(sql,{apply:false,cutoff:new Date(),operator:tag,limit:5});
    assert.ok(preview.overdueHoldReviews>=1);
    assert.deepEqual((await sql`SELECT name,email FROM users WHERE id=${owner.id}`)[0],before);
    await runRetention(sql,{apply:true,cutoff:new Date(),operator:tag,limit:5});
    assert.equal((await sql`SELECT name FROM users WHERE id=${owner.id}`)[0].name,'Retention owner');
    // Unrelated listing content is removed despite the account identity hold.
    assert.equal((await sql`SELECT description FROM listings WHERE id=${listing.id}`)[0].description,null);
    await reviewHold(sql,hold,admin.id,true);
    await runRetention(sql,{apply:true,cutoff:new Date(),operator:tag,limit:5});
    const [erased] = await sql`SELECT * FROM users WHERE id=${owner.id}`;
    assert.equal(erased.email,null); assert.equal(erased.password_hash,null); assert.ok(erased.anonymized_at);
    let removed=0;
    assert.ok((await drainMediaDeletions(sql,async()=>false)).failed>=1);
    await sql`UPDATE retention_media_deletions SET next_attempt_at=NOW()`;
    await drainMediaDeletions(sql,async()=>{removed++;return true;});
    assert.ok(removed>=1);
    const ledger = await exportLedger(sql);
    await assert.rejects(replayLedger(sql,{...ledger,instanceId:randomUUID()},tag),/different database/);
    await assert.rejects(replayLedger(sql,{...ledger,receipts:[{resource:'account',resource_id:owner.id,action:'delete',occurred_at:ledger.generatedAt}]},tag),/Invalid/);
    // Simulate old backup rows reappearing, then replay current deletion receipts.
    await sql`UPDATE users SET name='restored backup',email=${tag+'@example.invalid'},closed_at=NULL,anonymized_at=NULL WHERE id=${owner.id}`;
    await sql`UPDATE listings SET description='restored private text',redacted_at=NULL WHERE id=${listing.id}`;
    await sql`DELETE FROM retention_receipts WHERE (resource='account' AND resource_id=${owner.id}) OR (resource='listing' AND resource_id=${listing.id})`;
    await replayLedger(sql,ledger,tag);
    assert.equal((await sql`SELECT email FROM users WHERE id=${owner.id}`)[0].email,null);
    assert.equal((await sql`SELECT description FROM listings WHERE id=${listing.id}`)[0].description,null);
    await replayLedger(sql,ledger,tag);
    assert.equal((await sql`SELECT count(*)::int n FROM retention_receipts WHERE resource='account' AND resource_id=${owner.id} AND action='redact'`)[0].n,1);
    await assert.rejects(runRetention(sql,{apply:true,cutoff:new Date(Date.now()+86400_000),operator:tag}),/cutoff/);
  } finally {
    await sql`DELETE FROM retention_holds WHERE actor_user_id=${admin.id}`;
    await sql`DELETE FROM retention_runs WHERE operator=${tag} OR operator=${'admin:'+admin.id}`;
    await sql`DELETE FROM retention_receipts WHERE (resource='account' AND resource_id IN (${owner.id},${admin.id})) OR (resource='listing' AND resource_id=${listing.id})`;
    await sql`DELETE FROM saved_searches WHERE user_id=${owner.id}`;
    await sql`DELETE FROM listings WHERE id=${listing.id}`;
    await sql`DELETE FROM sessions WHERE user_id=${owner.id}`;
    await sql`DELETE FROM users WHERE id IN (${owner.id},${admin.id})`;
    await sql.end();
  }
});

test("calendar retention windows use closure/resolution dates and preserve alert deduplication", async () => {
  const sql=postgres(url,{max:1}); const tag=randomUUID();
  const [user]=await sql`INSERT INTO users(email) VALUES (${tag+'@example.invalid'}) RETURNING id`;
  const [city]=await sql`SELECT id FROM cities LIMIT 1`;
  const [listing]=await sql`INSERT INTO listings(vertical,seller_id,slug,title,price_pkr,city_id,status) VALUES ('part',${user.id},${tag},'Old inactive ad',2500,${city.id},'sold') RETURNING id`;
  const [service]=await sql`INSERT INTO inspections(requested_by_user_id,city_id,address,contact_phone,status) VALUES (${user.id},${city.id},'private address','+923001234567','completed') RETURNING id`;
  const [search]=await sql`INSERT INTO saved_searches(user_id,vertical,filters) VALUES (${user.id},'part','{}') RETURNING id`;
  try {
    await sql`UPDATE listings SET retention_inactive_at=NOW()-INTERVAL '12 months'+INTERVAL '1 day' WHERE id=${listing.id}`;
    await sql`UPDATE inspections SET closed_at=NOW()-INTERVAL '12 months'+INTERVAL '1 day' WHERE id=${service.id}`;
    await runRetention(sql,{apply:true,cutoff:new Date(),operator:tag});
    assert.equal((await sql`SELECT description,redacted_at FROM listings WHERE id=${listing.id}`)[0].redacted_at,null);
    assert.equal((await sql`SELECT address FROM inspections WHERE id=${service.id}`)[0].address,'private address');
    await earlyDeletion(sql,'inspection',service.id,tag,'Customer approved early deletion',false);
    assert.equal((await sql`SELECT address FROM inspections WHERE id=${service.id}`)[0].address,'private address');
    await earlyDeletion(sql,'inspection',service.id,tag,'Customer approved early deletion',true);
    assert.equal((await sql`SELECT address FROM inspections WHERE id=${service.id}`)[0].address,null);
    await sql`UPDATE listings SET retention_inactive_at=NOW()-INTERVAL '12 months'-INTERVAL '1 day' WHERE id=${listing.id}`;
    await sql`UPDATE inspections SET closed_at=NOW()-INTERVAL '12 months'-INTERVAL '1 day' WHERE id=${service.id}`;
    await sql`INSERT INTO saved_search_notifications(saved_search_id,listing_id,recipient_email,delivered,delivered_at,payload)
      VALUES (${search.id},${listing.id},${tag+'@example.invalid'},true,NOW()-INTERVAL '91 days','{"private":"email body"}')`;
    const [report]=await sql`INSERT INTO listing_reports(listing_id,reason,status,resolved_at) VALUES (${listing.id},'other','dismissed',NOW()-INTERVAL '24 months'-INTERVAL '1 day') RETURNING id`;
    const [lead]=await sql`INSERT INTO lead_events(listing_id,anon_id,type,created_at) VALUES (${listing.id},'private visitor','phone_reveal',NOW()-INTERVAL '91 days') RETURNING id`;
    await runRetention(sql,{apply:true,cutoff:new Date(),operator:tag});
    assert.ok((await sql`SELECT redacted_at FROM listings WHERE id=${listing.id}`)[0].redacted_at);
    assert.equal((await sql`SELECT address FROM inspections WHERE id=${service.id}`)[0].address,null);
    assert.equal((await sql`SELECT count(*)::int n FROM listing_reports WHERE id=${report.id}`)[0].n,0);
    assert.equal((await sql`SELECT count(*)::int n FROM lead_events WHERE id=${lead.id}`)[0].n,0);
    const [alert]=await sql`SELECT * FROM saved_search_notifications WHERE saved_search_id=${search.id}`;
    assert.equal(alert.recipient_email,''); assert.equal(alert.payload,null); assert.equal(alert.delivered,true);
    assert.equal((await sql`SELECT count(*)::int n FROM saved_search_notifications WHERE saved_search_id=${search.id} AND listing_id=${listing.id}`)[0].n,1);
    const ledger = await exportLedger(sql);
    const reservedId = Number((await sql`SELECT last_value FROM users_id_seq`)[0].last_value)+100;
    ledger.receipts.push({resource:'account',resource_id:reservedId,action:'redact',occurred_at:ledger.generatedAt});
    await replayLedger(sql,ledger,tag);
    const [nextUser] = await sql`INSERT INTO users(email) VALUES (${tag+'-after-restore@example.invalid'}) RETURNING id`;
    assert.ok(nextUser.id>reservedId,'Restored sequences must not reuse IDs present only in the deletion ledger');
    await sql`DELETE FROM users WHERE id=${nextUser.id}`;
    await sql`DELETE FROM retention_receipts WHERE resource='account' AND resource_id=${reservedId}`;
  } finally {
    await sql`DELETE FROM retention_runs WHERE operator=${tag}`;
    await sql`DELETE FROM retention_receipts WHERE (resource='listing' AND resource_id=${listing.id}) OR (resource='inspection' AND resource_id=${service.id})`;
    await sql`DELETE FROM saved_searches WHERE user_id=${user.id}`;
    await sql`DELETE FROM inspections WHERE id=${service.id}`;
    await sql`DELETE FROM listings WHERE id=${listing.id}`;
    await sql`DELETE FROM users WHERE id=${user.id}`;
    await sql.end();
  }
});

test("restore replay preserves later moderation and suppresses old pending alerts", async () => {
  const sql = postgres(url,{max:2});
  const tag = randomUUID();
  const [city] = await sql`SELECT id FROM cities LIMIT 1`;
  const [owner] = await sql`INSERT INTO users(email) VALUES (${tag+'@example.invalid'}) RETURNING id`;
  const [listing] = await sql`INSERT INTO listings(vertical,seller_id,slug,title,price_pkr,city_id,status,expires_at)
    VALUES ('part',${owner.id},${tag},'Replay listing',2500,${city.id},'active',NOW()+INTERVAL '1 day') RETURNING id`;
  const [search] = await sql`INSERT INTO saved_searches(user_id,filters,vertical,alert_frequency)
    VALUES (${owner.id},'{}','part','daily') RETURNING id`;
  const [notification] = await sql`INSERT INTO saved_search_notifications(saved_search_id,listing_id,recipient_email,payload)
    VALUES (${search.id},${listing.id},${tag+'@example.invalid'},'{}') RETURNING id`;
  try {
    await closeAccount(sql,owner.id);
    const [closed] = await sql`SELECT closed_at,closure_state FROM users WHERE id=${owner.id}`;
    await sql`UPDATE listings SET status='rejected',updated_at=NOW() WHERE id=${listing.id}`;
    await restoreAccount(sql,owner.id);
    assert.equal((await sql`SELECT status FROM listings WHERE id=${listing.id}`)[0].status,'rejected');
    const ledger = await exportLedger(sql);
    ledger.receipts = ledger.receipts.filter(row => row.resource === 'account' && row.resource_id === owner.id);

    // A backup from during closure contains its close receipt and the later moderation decision.
    await sql`UPDATE users SET closed_at=${closed.closed_at},closure_state=${sql.json(closed.closure_state)} WHERE id=${owner.id}`;
    await sql`DELETE FROM retention_receipts WHERE resource='account' AND resource_id=${owner.id} AND action='restore'`;
    await replayLedger(sql,ledger,tag);
    assert.equal((await sql`SELECT status FROM listings WHERE id=${listing.id}`)[0].status,'rejected');
    assert.equal((await sql`SELECT closed_at FROM users WHERE id=${owner.id}`)[0].closed_at,null);

    // A pre-close backup needs the close and restore effects, including terminal alert suppression.
    await sql`UPDATE users SET closed_at=NULL,closure_state=NULL WHERE id=${owner.id}`;
    await sql`UPDATE listings SET status='active',updated_at=NOW() WHERE id=${listing.id}`;
    await sql`UPDATE saved_searches SET alert_frequency='daily' WHERE id=${search.id}`;
    await sql`UPDATE saved_search_notifications SET suppressed_at=NULL,last_error=NULL WHERE id=${notification.id}`;
    await sql`DELETE FROM retention_receipts WHERE resource='account' AND resource_id=${owner.id}`;
    await replayLedger(sql,ledger,tag);
    await replayLedger(sql,ledger,tag);
    assert.equal((await sql`SELECT status FROM listings WHERE id=${listing.id}`)[0].status,'active');
    assert.ok((await sql`SELECT suppressed_at FROM saved_search_notifications WHERE id=${notification.id}`)[0].suppressed_at);
    assert.equal((await sql`SELECT alert_frequency FROM saved_searches WHERE id=${search.id}`)[0].alert_frequency,'daily');
  } finally {
    await sql`DELETE FROM retention_runs WHERE operator=${tag}`;
    await sql`DELETE FROM retention_receipts WHERE resource='account' AND resource_id=${owner.id}`;
    await sql`DELETE FROM saved_searches WHERE id=${search.id}`;
    await sql`DELETE FROM listings WHERE id=${listing.id}`;
    await sql`DELETE FROM users WHERE id=${owner.id}`;
    await sql.end();
  }
});

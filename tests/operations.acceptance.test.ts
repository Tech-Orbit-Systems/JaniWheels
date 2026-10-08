import "dotenv/config";
import assert from "node:assert/strict";
import {test} from "node:test";
import {createHmac,randomUUID} from "node:crypto";
import postgres from "postgres";
import {operationsReport} from "../src/lib/operations/report";
import {permitsMutationOrigin} from "../src/lib/security/origin";
import {consumeRateLimit} from "../src/lib/security/rate-limit";
import {searchListings,type SortKey} from "../src/lib/listings/search";
import type {Vertical} from "../src/lib/seo/facets";
import {logSafeError} from "../src/lib/operations/safe-error";

const url=process.env.DATABASE_URL!;
assert.match(new URL(url).pathname,/(?:_test|_acceptance)$/);

test('handled error logging omits query parameters and customer identifiers',()=>{
  const original=console.error;
  const captured:string[]=[];
  console.error=(...args:unknown[])=>{captured.push(args.map(String).join(' '));};
  try {
    logSafeError('lead.phone_record_failed',{code:'23514',message:'private-token-marker',query:'INSERT private-query-marker',params:['private-user-marker','private-referrer-marker']});
    assert.deepEqual(JSON.parse(captured[0]),{event:'lead.phone_record_failed',code:'23514'});
    assert.ok(!captured[0].includes('private-'));
  } finally {console.error=original;}
});

test('paginated browse enrichment preserves every sort, vertical and primary photo',async()=>{
  const sql=postgres(url,{max:1});
  const tag=randomUUID(),price=1900000000+Math.floor(Math.random()*1000000);
  const orders:Record<SortKey,string>={recent:'published_at DESC',price_asc:'price_pkr ASC',price_desc:'price_pkr DESC',year_desc:'year DESC',year_asc:'year ASC',mileage_asc:'mileage_km ASC'};
  try {
    for(const vertical of ['car','bike','part'] as Vertical[]) {
      await sql`INSERT INTO listings SELECT r.* FROM (SELECT * FROM listings WHERE vertical=${vertical} AND status='active' ORDER BY id LIMIT 1) l CROSS JOIN generate_series(1,30) g CROSS JOIN LATERAL jsonb_populate_record(NULL::listings,to_jsonb(l)||jsonb_build_object('id',nextval('listings_id_seq'),'title',${tag}::text,'slug',${tag}::text||g::text,'price_pkr',${price}::integer,'year',CASE WHEN g%7=0 THEN NULL ELSE 2000+g%6 END,'mileage_km',g%5*1000,'published_at',NOW()-make_interval(days=>g%4),'seller_deleted_at',NULL,'redacted_at',NULL)) r`;
      const [first]=await sql`SELECT id FROM listings WHERE title=${tag} AND vertical=${vertical} ORDER BY id LIMIT 1`;
      const primaryKey=`acceptance/${tag}-${vertical}-a.webp`;
      await sql`INSERT INTO listing_images(listing_id,storage_key,position) VALUES (${first.id},${`acceptance/${tag}-${vertical}-z.webp`},0),(${first.id},${primaryKey},0)`;
      for(const [sort,order] of Object.entries(orders)) {
        const expected=await sql.unsafe(`SELECT id FROM listings WHERE title=$1 AND vertical=$2 ORDER BY ${order},id DESC`,[tag,vertical]);
        for(const page of [1,2]) {
          const result=await searchListings({vertical,price:{min:price,max:price},sort,page});
          assert.equal(result.total,30);
          assert.equal(result.pageCount,2);
          assert.deepEqual(result.rows.map(r=>r.id),expected.slice((page-1)*25,page*25).map(r=>r.id));
          const image=result.rows.find(r=>r.id===first.id);
          if(image) assert.equal(image.primaryImageKey,primaryKey);
        }
      }
    }
  } finally {await sql`DELETE FROM listings WHERE title=${tag}`;await sql.end();}
});

test('operations report exposes aggregates without customer or hold payloads',async()=>{
  const sql=postgres(url,{max:1});
  const tag=randomUUID();
  const [user]=await sql`INSERT INTO users(email,name) VALUES (${tag+'@example.invalid'},${tag}) RETURNING id`;
  try {
    await sql`INSERT INTO retention_holds(resource,resource_id,reason,responsible,reviewed_at) VALUES ('account',${user.id},${tag},${tag},NOW()-INTERVAL '91 days')`;
    const report=await operationsReport(sql);
    assert.equal(report.mode,'read-only');
    assert.ok(report.accounts.total>=1);
    assert.ok(report.retention.overdue_hold_reviews>=1);
    assert.ok(report.inventory.length>=3);
    assert.equal(JSON.stringify(report).includes(tag),false);
    assert.equal((await sql`SELECT name FROM users WHERE id=${user.id}`)[0].name,tag);
    assert.match(report.definitions.views,/not unique human visitors/);
  } finally {
    await sql`DELETE FROM retention_holds WHERE resource='account' AND resource_id=${user.id}`;
    await sql`DELETE FROM users WHERE id=${user.id}`;
    await sql.end();
  }
});

test('mutation origins reject foreign hosts, schemes, ports, opaque origins and spoofed Host',()=>{
  const base='https://janiwheels.com';
  for(const origin of ['https://foreign.example','http://janiwheels.com','https://janiwheels.com:8443','null','https://janiwheels.com/path','https://user:pass@janiwheels.com']) {
    assert.equal(permitsMutationOrigin(new Request(base+'/api/upload',{headers:{origin,host:new URL(origin==='null'?base:origin).host}}),base),false,origin);
  }
  assert.equal(permitsMutationOrigin(new Request(base+'/api/upload',{headers:{origin:base}}),base),true);
  assert.equal(permitsMutationOrigin(new Request(base+'/api/upload',{headers:{'sec-fetch-site':'cross-site'}}),base),false);
});

test('exhausted rate limit recovers at the next time window',async()=>{
  const sql=postgres(url,{max:1});
  const scope='window-test-'+randomUUID(),subject='acceptance';
  const now=Date.now(),windowMs=3600_000,period=Math.floor(now/windowMs);
  const original=Date.now;
  const keys=[period,period+1].map(p=>createHmac('sha256',process.env.SESSION_SECRET!).update(`${scope}\0${subject}\0${p}`).digest('hex'));
  try {
    Date.now=()=>now;
    assert.equal(await consumeRateLimit({scope,subject,max:2,windowMs}),true);
    assert.equal(await consumeRateLimit({scope,subject,max:2,windowMs}),true);
    assert.equal(await consumeRateLimit({scope,subject,max:2,windowMs}),false);
    Date.now=()=>((period+1)*windowMs+1);
    assert.equal(await consumeRateLimit({scope,subject,max:2,windowMs}),true);
  } finally {Date.now=original;await sql`DELETE FROM rate_limit_buckets WHERE key IN ${sql(keys)}`;await sql.end();}
});

import {expect,test,type Page} from "@playwright/test";
import "dotenv/config";
import {createHmac,randomUUID} from "node:crypto";
import {mkdir,readFile,rm,writeFile} from "node:fs/promises";
import {dirname,join} from "node:path";
import postgres from "postgres";
import sharp from "sharp";
import {closeAccount,exportLedger,replayLedger} from "../../src/lib/retention/core";

const url=process.env.DATABASE_URL!;
if (!/(?:_test|_acceptance)$/.test(new URL(url).pathname)) throw new Error("Isolated acceptance database required");
const sql=postgres(url,{max:3});
test.afterAll(async()=>{await sql.end();});
async function fixture(vertical:'car'|'bike'='car') {
  const tag=randomUUID();
  const [owner]=await sql`INSERT INTO users(name,email,email_verified_at,password_hash) SELECT 'Closeout seller',${tag+'@example.invalid'},NOW(),password_hash FROM users WHERE email='acceptance-seller@example.invalid' RETURNING id,email`;
  const [admin]=await sql`INSERT INTO users(name,email,email_verified_at,password_hash,is_admin) SELECT 'Closeout administrator',${tag+'-admin@example.invalid'},NOW(),password_hash,true FROM users WHERE email='acceptance-admin@example.invalid' RETURNING id,email`;
  const [listing]=await sql`INSERT INTO listings SELECT r.* FROM listings l CROSS JOIN LATERAL jsonb_populate_record(NULL::listings,to_jsonb(l)||jsonb_build_object('id',nextval('listings_id_seq'),'seller_id',${owner.id}::integer,'dealer_id',NULL,'title',${tag}::text,'slug',${tag}::text,'status','active','seller_deleted_at',NULL,'redacted_at',NULL,'photo_count',1)) r WHERE l.vertical=${vertical} AND l.status='active' AND l.variant_id IS NOT NULL ORDER BY l.id LIMIT 1 RETURNING id,slug`;
  const detailTable=vertical==='car'?'car_details':'bike_details';
  await sql`INSERT INTO ${sql(detailTable)} SELECT r.* FROM ${sql(detailTable)} c CROSS JOIN LATERAL jsonb_populate_record(NULL::${sql(detailTable)},to_jsonb(c)||jsonb_build_object('listing_id',${listing.id}::integer)) r WHERE c.listing_id=(SELECT id FROM listings WHERE vertical=${vertical} AND status='active' AND variant_id IS NOT NULL ORDER BY id LIMIT 1)`;
  const key=`202610/${tag.replaceAll('-','')}.webp`;
  const path=join(process.env.UPLOAD_DIR!,key);
  await mkdir(dirname(path),{recursive:true});
  await writeFile(path,await sharp({create:{width:24,height:24,channels:3,background:'#7799aa'}}).webp().toBuffer());
  await sql`INSERT INTO listing_images(listing_id,storage_key,position) VALUES (${listing.id},${key},0)`;
  await sql`UPDATE listings SET updated_at=NOW() WHERE id=${listing.id}`;
  return {tag,owner,admin,listing,key,path};
}
function bucket(scope:string,id:number,max:number) {
  const period=Math.floor(Date.now()/3600_000);
  const key=createHmac('sha256',process.env.SESSION_SECRET!).update(`account:${scope}\0user:${id}\0${period}`).digest('hex');
  return sql`INSERT INTO rate_limit_buckets(key,hits,expires_at) VALUES (${key},${max},NOW()+INTERVAL '1 hour') ON CONFLICT(key) DO UPDATE SET hits=EXCLUDED.hits`;
}
async function cleanup(f:Awaited<ReturnType<typeof fixture>>) {
  await sql`DELETE FROM retention_runs WHERE operator=${f.tag}`;
  await sql`DELETE FROM retention_holds WHERE resource='listing' AND resource_id=${f.listing.id}`;
  await sql`DELETE FROM retention_receipts WHERE resource='account' AND resource_id=${f.owner.id}`;
  await sql`DELETE FROM retention_receipts WHERE resource='listing' AND resource_id=${f.listing.id}`;
  await sql`DELETE FROM moderation_log WHERE listing_id=${f.listing.id}`;
  await sql`DELETE FROM listings WHERE id=${f.listing.id}`;
  await sql`DELETE FROM sessions WHERE user_id IN (${f.owner.id},${f.admin.id})`;
  await sql`DELETE FROM users WHERE id IN (${f.owner.id},${f.admin.id})`;
  await rm(f.path,{force:true});
}
async function login(page:Page,email:string,next='/dashboard') {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByRole('textbox',{name:'Email or mobile number'}).fill(email);
  await page.getByLabel('Password').fill('AcceptanceOnly123!');
  await page.getByRole('button',{name:'Sign in'}).click();
  await expect(page).not.toHaveURL(/\/login/);
}
async function capture(page:Page,click:()=>Promise<void>) {
  const request=page.waitForRequest(r=>r.method()==='POST' && Boolean(r.headers()['next-action']));
  await page.route('**/*',async route=>{if(route.request().headers()['next-action']) await route.abort(); else await route.continue();});
  await click();
  const r=await request;
  await page.unrouteAll({behavior:'wait'});
  const headers={...r.headers()};
  // API replay must explicitly carry the browser's secure local session cookie.
  headers.cookie=(await page.context().cookies()).map(c=>`${c.name}=${c.value}`).join('; ');
  delete headers.host; delete headers['content-length'];
  return {url:r.url(),headers,data:r.postDataBuffer()!};
}

test('autonomy seller lifecycle blocks stale actions and preserves deleted photos privately',async({page})=>{
  const f=await fixture();
  try {
    await login(page,f.owner.email);
    const row=()=>page.getByRole('listitem').filter({hasText:f.tag});
    const sold=await capture(page,async()=>{await row().getByRole('button',{name:'Mark as sold'}).click();await row().getByRole('button',{name:'Yes',exact:true}).click();});
    const foreign=await page.request.post(sold.url,{data:sold.data,headers:{...sold.headers,origin:'https://foreign.example.invalid'},maxRedirects:0});
    expect(foreign.status()).toBeGreaterThanOrEqual(400);
    expect((await sql`SELECT status FROM listings WHERE id=${f.listing.id}`)[0].status).toBe('active');
    await bucket('listing-write',f.owner.id,120);
    await page.request.post(sold.url,{data:sold.data,headers:sold.headers,maxRedirects:0});
    expect((await sql`SELECT status FROM listings WHERE id=${f.listing.id}`)[0].status).toBe('active');
    await page.goto('/dashboard?limited=1');
    await expect(page.getByRole('alert').filter({hasText:'Too many changes.'})).toHaveText('Too many changes. Please wait and try again.');
    await bucket('listing-write',f.owner.id,0);
    // A delayed action must show pending feedback and prevent duplicate clicks.
    await page.route('**/*',async route=>{if(route.request().headers()['next-action']) await new Promise(resolve=>setTimeout(resolve,1500));await route.continue();});
    await row().getByRole('button',{name:'Mark as sold'}).click();
    await row().getByRole('button',{name:'Yes',exact:true}).click();
    await expect(row().getByRole('button',{name:'…',exact:true})).toBeDisabled();
    await expect.poll(async()=>(await sql`SELECT status FROM listings WHERE id=${f.listing.id}`)[0].status).toBe('sold');
    await page.unrouteAll({behavior:'wait'});
    await page.goto('/dashboard');
    expect((await page.request.get(`/used-cars/${f.listing.slug}-${f.listing.id}`,{headers:{cookie:''},maxRetries:2})).status()).toBe(404);
    expect(await (await page.request.get(`/api/recently-viewed?ids=${f.listing.id}`)).json()).toEqual({rows:[]});
    expect(await (await page.request.get('/sitemap.xml')).text()).not.toContain(`${f.listing.slug}-${f.listing.id}`);
    await row().getByRole('button',{name:'Delete ad',exact:true}).click();
    await row().getByRole('button',{name:'Yes, delete'}).click();
    await expect.poll(async()=>(await sql`SELECT seller_deleted_at FROM listings WHERE id=${f.listing.id}`)[0].seller_deleted_at).toBeTruthy();
    const [receipt]=await sql`SELECT action FROM retention_receipts WHERE resource='listing' AND resource_id=${f.listing.id}`;
    expect(receipt.action).toBe('seller-delete');
    const ledger=await exportLedger(sql);
    ledger.receipts=ledger.receipts.filter(r=>r.resource==='listing' && r.resource_id===f.listing.id);
    await sql`UPDATE listings SET status='active',seller_deleted_at=NULL WHERE id=${f.listing.id}`;
    await sql`DELETE FROM retention_receipts WHERE resource='listing' AND resource_id=${f.listing.id}`;
    await replayLedger(sql,ledger,f.tag);
    await replayLedger(sql,ledger,f.tag);
    expect((await sql`SELECT status,seller_deleted_at FROM listings WHERE id=${f.listing.id}`)[0]).toMatchObject({status:'removed'});
    expect((await page.request.get(`/used-cars/${f.listing.slug}-${f.listing.id}`,{headers:{cookie:''},maxRetries:2})).status()).toBe(404);
    await page.request.post(sold.url,{data:sold.data,headers:sold.headers,maxRedirects:0});
    expect((await sql`SELECT status FROM listings WHERE id=${f.listing.id}`)[0].status).toBe('removed');
    expect((await sql`SELECT count(*)::int n FROM listing_images WHERE listing_id=${f.listing.id}`)[0].n).toBe(1);
    expect((await readFile(f.path)).length).toBeGreaterThan(0);
    expect((await page.request.get(`/uploads/${f.key}`,{headers:{cookie:sold.headers.cookie}})).status()).toBe(404);
    await page.context().clearCookies();
    await login(page,f.admin.email,'/admin/listings');
    const adminCookie=(await page.context().cookies()).map(c=>`${c.name}=${c.value}`).join('; ');
    expect((await page.request.get(`/uploads/${f.key}`,{headers:{cookie:adminCookie}})).status()).toBe(200);
  } finally {await cleanup(f);}
});

test('autonomy reactivation respects the shared individual quota',async({page})=>{
  const f=await fixture();
  const replacements:number[]=[];
  try {
    await sql`UPDATE listings SET status='sold' WHERE id=${f.listing.id}`;
    for(let i=0;i<3;i++) {
      const [row]=await sql`INSERT INTO listings SELECT r.* FROM listings l CROSS JOIN LATERAL jsonb_populate_record(NULL::listings,to_jsonb(l)||jsonb_build_object('id',nextval('listings_id_seq'),'title','Quota replacement','slug','quota-replacement','status','active','photo_count',0)) r WHERE l.id=${f.listing.id} RETURNING id`;
      replacements.push(row.id);
    }
    await login(page,f.owner.email);
    const row=()=>page.getByRole('listitem').filter({hasText:f.tag});
    await row().getByRole('button',{name:'Reactivate for 30 days'}).click();
    await expect(page.getByRole('alert').filter({hasText:'You already have 3 live ads'})).toBeVisible();
    expect((await sql`SELECT status FROM listings WHERE id=${f.listing.id}`)[0].status).toBe('sold');
    await sql`UPDATE listings SET status='sold' WHERE id=${replacements[0]}`;
    await page.goto('/dashboard');
    await row().getByRole('button',{name:'Reactivate for 30 days'}).click();
    await expect.poll(async()=>(await sql`SELECT status FROM listings WHERE id=${f.listing.id}`)[0].status).toBe('active');
    expect((await sql`SELECT count(*)::int n FROM listings WHERE seller_id=${f.owner.id} AND status IN ('active','pending_review')`)[0].n).toBe(3);
  } finally {
    if(replacements.length) await sql`DELETE FROM listings WHERE id IN ${sql(replacements)}`;
    await cleanup(f);
  }
});

test('autonomy rejected-ad resubmission respects the shared quota',async({page})=>{
  const f=await fixture();
  const replacements:number[]=[];
  try {
    await sql`UPDATE listings SET status='rejected' WHERE id=${f.listing.id}`;
    const [before]=await sql`SELECT price_pkr FROM listings WHERE id=${f.listing.id}`;
    for(let i=0;i<3;i++) {
      const [row]=await sql`INSERT INTO listings SELECT r.* FROM listings l CROSS JOIN LATERAL jsonb_populate_record(NULL::listings,to_jsonb(l)||jsonb_build_object('id',nextval('listings_id_seq'),'title','Resubmission quota replacement','slug','resubmission-quota-replacement','status','active','photo_count',0)) r WHERE l.id=${f.listing.id} RETURNING id`;
      replacements.push(row.id);
    }
    await login(page,f.owner.email,`/dashboard/listings/${f.listing.id}/edit`);
    await page.locator('input[name="pricePkr"]').fill('3650000');
    await page.getByRole('button',{name:'Save and resubmit ad'}).click();
    await expect(page.getByText('You already have 3 live ads. Mark one as sold, or upgrade to a dealer account.')).toBeVisible();
    await expect(page.locator('input[name="pricePkr"]')).toHaveValue('3650000');
    await expect(page.locator('select[name="variantId"]')).not.toHaveValue('');
    expect((await sql`SELECT status,price_pkr FROM listings WHERE id=${f.listing.id}`)[0]).toMatchObject({status:'rejected',price_pkr:before.price_pkr});
    await sql`UPDATE listings SET status='sold' WHERE id=${replacements[0]}`;
    await page.getByRole('button',{name:'Save and resubmit ad'}).click();
    await expect(page).toHaveURL(/\/dashboard\?updated=1$/);
    expect((await sql`SELECT status,price_pkr FROM listings WHERE id=${f.listing.id}`)[0]).toMatchObject({status:'pending_review',price_pkr:3650000});
  } finally {
    if(replacements.length) await sql`DELETE FROM listings WHERE id IN ${sql(replacements)}`;
    await cleanup(f);
  }
});

test('autonomy banned inventory hides detail media contact and discovery until unban',async({page})=>{
  const f=await fixture();
  const phone='+92300'+String(f.owner.id).padStart(7,'0');
  const path=`/used-cars/${f.listing.slug}-${f.listing.id}`;
  try {
    await sql`UPDATE users SET phone=${phone} WHERE id=${f.owner.id}`;
    await page.goto(path);
    const action=await capture(page,()=>page.getByRole('button',{name:/Show number/}).click());
    await sql`UPDATE users SET is_banned=true WHERE id=${f.owner.id}`;
    expect((await page.request.get(path,{headers:{cookie:''}})).status()).toBe(404);
    expect((await page.request.get(`/uploads/${f.key}`,{headers:{cookie:''}})).status()).toBe(404);
    expect((await page.request.head(`/uploads/${f.key}`,{headers:{cookie:''}})).status()).toBe(404);
    expect(await (await page.request.get(`/api/recently-viewed?ids=${f.listing.id}`)).json()).toEqual({rows:[]});
    expect(await (await page.request.get('/sitemap.xml')).text()).not.toContain(`${f.listing.slug}-${f.listing.id}`);
    const contact=await page.request.post(action.url,{data:action.data,headers:action.headers});
    const body=await contact.text();
    expect(body).toContain('This listing is no longer available.');
    expect(body).not.toContain(phone);
    await sql`UPDATE users SET is_banned=false WHERE id=${f.owner.id}`;
    expect((await page.request.get(path,{headers:{cookie:''}})).status()).toBe(200);
    await sql`UPDATE listings SET status='removed' WHERE id=${f.listing.id}`;
    await sql`UPDATE users SET is_banned=true WHERE id=${f.owner.id}`;
    await sql`UPDATE users SET is_banned=false WHERE id=${f.owner.id}`;
    expect((await page.request.get(path,{headers:{cookie:''}})).status()).toBe(404);
  } finally {await cleanup(f);}
});

test('autonomy authenticated return paths stay on the local website',async({page})=>{
  const f=await fixture();
  try {
    await login(page,f.owner.email);
    const cookie=(await page.context().cookies()).map(c=>`${c.name}=${c.value}`).join('; ');
    for(const target of ['/\\attacker.example/review','//attacker.example','/%5cattacker.example','/safe/..//attacker.example']) {
      const response=await page.request.get(`/login?next=${encodeURIComponent(target)}`,{headers:{cookie},maxRedirects:0});
      expect(response.status()).toBe(307);
      expect(response.headers().location).toBe('/');
    }
    const normal=await page.request.get('/login?next=%2Fdashboard%3Ftab%3Dads',{headers:{cookie},maxRedirects:0});
    expect(normal.headers().location).toBe('/dashboard?tab=ads');
  } finally {await cleanup(f);}
});

test('autonomy admin tampering and concurrent decisions preserve state and one audit',async({page})=>{
  const f=await fixture();
  try {
    await login(page,f.admin.email,'/admin/listings');
    const row=page.getByRole('article').filter({hasText:f.tag});
    await row.getByPlaceholder('Rejection reason (required to reject)').fill('Acceptance removal reason');
    const action=await capture(page,()=>row.getByRole('button',{name:'Remove',exact:true}).click());
    const args=JSON.parse(action.data.toString());
    expect(args).toEqual([f.listing.id,'remove','Acceptance removal reason']);
    for (const invalid of [[f.listing.id,'unexpected','Acceptance removal reason'],[-1,'remove','Acceptance removal reason'],[f.listing.id,'remove','x'.repeat(501)]]) {
      expect((await page.request.post(action.url,{data:JSON.stringify(invalid),headers:action.headers})).status()).toBe(200);
      expect((await sql`SELECT status FROM listings WHERE id=${f.listing.id}`)[0].status).toBe('active');
    }
    await bucket('admin-write',f.admin.id,300);
    await page.request.post(action.url,{data:action.data,headers:action.headers});
    expect((await sql`SELECT status FROM listings WHERE id=${f.listing.id}`)[0].status).toBe('active');
    expect((await sql`SELECT count(*)::int n FROM moderation_log WHERE listing_id=${f.listing.id}`)[0].n).toBe(0);
    await bucket('admin-write',f.admin.id,0);
    await Promise.all(Array.from({length:3},()=>page.request.post(action.url,{data:action.data,headers:action.headers})));
    expect((await sql`SELECT status FROM listings WHERE id=${f.listing.id}`)[0].status).toBe('removed');
    expect((await sql`SELECT count(*)::int n FROM moderation_log WHERE listing_id=${f.listing.id}`)[0].n).toBe(1);
  } finally {await cleanup(f);}
});

test('autonomy complaint hold rejects edit without changing details or photos',async({page})=>{
  const f=await fixture();
  try {
    await sql`INSERT INTO retention_holds(resource,resource_id,reason,responsible,actor_user_id) VALUES ('listing',${f.listing.id},'Necessary complaint evidence','Acceptance administrator',${f.admin.id})`;
    const [before]=await sql`SELECT price_pkr FROM listings WHERE id=${f.listing.id}`;
    await login(page,f.owner.email,`/dashboard/listings/${f.listing.id}/edit`);
    await page.locator('input[name="pricePkr"]').fill('3650000');
    await page.getByRole('button',{name:'Save advertisement changes'}).click();
    await expect(page.getByText('This ad is under complaint review. Its details and photos cannot be changed until the review is released.')).toBeVisible();
    expect((await sql`SELECT price_pkr FROM listings WHERE id=${f.listing.id}`)[0].price_pkr).toBe(before.price_pkr);
    expect((await sql`SELECT count(*)::int n FROM listing_images WHERE listing_id=${f.listing.id}`)[0].n).toBe(1);
  } finally {await cleanup(f);}
});

for(const vertical of ['car','bike'] as const) test(`${vertical} vehicle edit rejects inactive ancestors and forged variants`,async({page})=>{
  const f=await fixture(vertical);
  let makeId:number|undefined,modelId:number|undefined,variantId:number|undefined;
  try {
    const [original]=await sql`SELECT variant_id,price_pkr,make_id,model_id FROM listings WHERE id=${f.listing.id}`;
    const [make]=await sql`INSERT INTO makes(vertical,slug,name) VALUES (${vertical},${f.tag},'Acceptance make') RETURNING id`;
    makeId=make.id;
    const [model]=await sql`INSERT INTO models(make_id,vertical,slug,name,full_slug) VALUES (${make.id},${vertical},${f.tag},'Acceptance model',${f.tag}) RETURNING id`;
    modelId=model.id;
    const [variant]=await sql`INSERT INTO variants(model_id,slug,name,fuel) SELECT ${model.id},${f.tag},'Acceptance variant',fuel FROM variants WHERE id=${original.variant_id} RETURNING id`;
    variantId=variant.id;
    await login(page,f.owner.email,`/dashboard/listings/${f.listing.id}/edit`);
    const request=await capture(page,()=>page.getByRole('button',{name:'Save advertisement changes'}).click());
    const originalBody=request.data.toString();
    expect(originalBody).toMatch(/name="_1_variantId"\r?\n\r?\n\d+/);
    expect(originalBody).toMatch(/name="_1_customMakeName"\r?\n\r?\n/);
    expect(originalBody).toMatch(/name="_1_customModelName"\r?\n\r?\n/);
    const submit=(id:number|string,withFallback=false)=>{
      let body=originalBody.replace(/(name="_1_variantId"\r?\n\r?\n)\d+/,(_,prefix:string)=>`${prefix}${id}`);
      if(withFallback) body=body
        .replace(/(name="_1_customMakeName"\r?\n\r?\n)[^\r\n]*/,(_,prefix:string)=>`${prefix}Fallback make`)
        .replace(/(name="_1_customModelName"\r?\n\r?\n)[^\r\n]*/,(_,prefix:string)=>`${prefix}Fallback model`);
      return page.request.post(request.url,{data:Buffer.from(body),headers:request.headers});
    };
    for(const [table,id] of [['makes',make.id],['models',model.id],['variants',variant.id]] as const) {
      await sql`UPDATE ${sql(table)} SET is_active=false WHERE id=${id}`;
      const response=await submit(variant.id);
      expect(response.status()).toBe(200);
      expect(await response.text()).toContain('Choose valid category and vehicle options.');
      expect((await sql`SELECT variant_id,price_pkr,make_id,model_id FROM listings WHERE id=${f.listing.id}`)[0]).toEqual(original);
      await sql`UPDATE ${sql(table)} SET is_active=true WHERE id=${id}`;
    }
    const forged=await submit(2147483647);
    expect(forged.status()).toBe(200);
    expect(await forged.text()).toContain('Choose valid category and vehicle options.');
    expect((await sql`SELECT variant_id,price_pkr,make_id,model_id FROM listings WHERE id=${f.listing.id}`)[0]).toEqual(original);
    for(const malformed of ['not-a-number','NaN','Infinity','2147483648']) {
      const response=await submit(malformed,true);
      expect(response.status()).toBe(200);
      expect(await response.text()).toContain('Please fix the highlighted fields.');
      expect((await sql`SELECT variant_id,price_pkr,make_id,model_id FROM listings WHERE id=${f.listing.id}`)[0]).toEqual(original);
      expect((await sql`SELECT count(*)::int n FROM listing_images WHERE listing_id=${f.listing.id}`)[0].n).toBe(1);
    }
    const fallback=await submit('',true);
    expect(fallback.status()).toBe(303);
    expect((await sql`SELECT variant_id,custom_make_name,custom_model_name FROM listings WHERE id=${f.listing.id}`)[0])
      .toMatchObject({variant_id:null,custom_make_name:'Fallback make',custom_model_name:'Fallback model'});
    const valid=await submit(variant.id);
    expect(valid.status()).toBe(303);
    expect((await sql`SELECT variant_id,make_id,model_id FROM listings WHERE id=${f.listing.id}`)[0]).toMatchObject({variant_id:variant.id,make_id:make.id,model_id:model.id});
  } finally {
    await cleanup(f);
    if(variantId) await sql`DELETE FROM variants WHERE id=${variantId}`;
    if(modelId) await sql`DELETE FROM models WHERE id=${modelId}`;
    if(makeId) await sql`DELETE FROM makes WHERE id=${makeId}`;
  }
});

async function waitForLock(fragment:string) {
  await expect.poll(async()=>{
    const [row]=await sql`SELECT count(*)::int n FROM pg_stat_activity
      WHERE datname=current_database() AND wait_event_type='Lock' AND query ILIKE ${'%'+fragment+'%'}`;
    return row.n;
  },{timeout:10000}).toBeGreaterThan(0);
}

for(const decision of ['approve','reinstate'] as const) for(const schedule of ['admin-first','closure-first'] as const) {
  test(`admin ${decision} and closure serialize in ${schedule} order`,async({page})=>{
    const f=await fixture();
    let release!:()=>void;
    let ready!:()=>void;
    const gate=new Promise<void>(resolve=>{release=resolve;});
    const held=new Promise<void>(resolve=>{ready=resolve;});
    let blocker:Promise<unknown>|undefined;
    try {
      await sql`UPDATE listings SET status='pending_review' WHERE id=${f.listing.id}`;
      await login(page,f.admin.email,'/admin/moderation');
      const row=page.getByRole('listitem').filter({hasText:f.tag});
      if(decision==='reinstate') await row.getByPlaceholder('Rejection reason (required to reject)').fill('Review completed safely');
      const action=await capture(page,()=>row.getByRole('button',{name:decision==='approve'?'Approve':'Reinstate'}).click());
      blocker=sql.begin(async tx=>{
        if(schedule==='admin-first') await tx`SELECT id FROM listings WHERE id=${f.listing.id} FOR UPDATE`;
        else await tx`SELECT id FROM users WHERE id=${f.owner.id} FOR UPDATE`;
        ready();
        await gate;
      });
      await held;
      let adminRequest:Promise<Awaited<ReturnType<typeof page.request.post>>>;
      let closure:Promise<unknown>;
      if(schedule==='admin-first') {
        adminRequest=page.request.post(action.url,{data:action.data,headers:action.headers,timeout:15000});
        await waitForLock('FROM "listings"');
        closure=closeAccount(sql,f.owner.id);
        await waitForLock('FROM users WHERE id=');
      } else {
        closure=closeAccount(sql,f.owner.id);
        await waitForLock('FROM users WHERE id=');
        adminRequest=page.request.post(action.url,{data:action.data,headers:action.headers,timeout:15000});
        await waitForLock('FROM "users"');
      }
      release();
      const [response]=await Promise.all([adminRequest,closure,blocker]);
      expect(response.status()).toBeLessThan(500);
      expect(await response.text()).not.toMatch(/\d+:E\{"digest":"\d+"/);
      const [listing]=await sql`SELECT status FROM listings WHERE id=${f.listing.id}`;
      const [owner]=await sql`SELECT closed_at FROM users WHERE id=${f.owner.id}`;
      expect(owner.closed_at).toBeTruthy();
      expect(listing.status).toBe('removed');
      const [audit]=await sql`SELECT count(*)::int n FROM moderation_log WHERE listing_id=${f.listing.id}`;
      expect(audit.n).toBe(schedule==='admin-first'?1:0);
    } finally {
      release?.();
      await blocker?.catch(()=>{});
      await cleanup(f);
    }
  });
}

for(const existingCount of [3,4] as const) {
  test(`reciprocal authenticated reports serialize with ${existingCount} prior reports`,async({page,browser})=>{
    const a=await fixture();
    const b=await fixture();
    const contextB=await browser.newContext();
    const pageB=await contextB.newPage();
    let release!:()=>void;
    let ready!:()=>void;
    const gate=new Promise<void>(resolve=>{release=resolve;});
    const held=new Promise<void>(resolve=>{ready=resolve;});
    let blocker:Promise<unknown>|undefined;
    let settled:Promise<PromiseSettledResult<Awaited<ReturnType<typeof page.request.post>>>[]>|undefined;
    try {
      for(const listing of [a.listing,b.listing]) for(let i=0;i<existingCount;i++) {
        await sql`INSERT INTO listing_reports(listing_id,reporter_anon_id,reason) VALUES (${listing.id},${`${a.tag}-${listing.id}-${i}`},'fraud')`;
      }
      await login(page,a.owner.email);
      await page.goto(`/used-cars/${b.listing.slug}-${b.listing.id}`);
      await page.getByRole('button',{name:'Report this ad'}).click();
      await page.locator('select[name="reason"]').selectOption('fraud');
      const actionA=await capture(page,()=>page.getByRole('button',{name:'Send report'}).click());
      await login(pageB,b.owner.email);
      await pageB.goto(`/used-cars/${a.listing.slug}-${a.listing.id}`);
      await pageB.getByRole('button',{name:'Report this ad'}).click();
      await pageB.locator('select[name="reason"]').selectOption('fraud');
      const actionB=await capture(pageB,()=>pageB.getByRole('button',{name:'Send report'}).click());
      blocker=sql.begin(async tx=>{
        await tx`SELECT id FROM listings WHERE id IN (${a.listing.id},${b.listing.id}) ORDER BY id FOR UPDATE`;
        ready();
        await gate;
      });
      await held;
      const requests=[
        page.request.post(actionA.url,{data:actionA.data,headers:actionA.headers,timeout:15000}),
        pageB.request.post(actionB.url,{data:actionB.data,headers:actionB.headers,timeout:15000}),
      ];
      settled=Promise.allSettled(requests);
      await expect.poll(async()=>{
        const [row]=await sql`SELECT count(*)::int n FROM pg_stat_activity
          WHERE datname=current_database() AND wait_event_type='Lock'
          AND query ILIKE '%FROM "listings"%' AND query ILIKE '%FOR UPDATE%'`;
        return row.n;
      },{timeout:10000}).toBeGreaterThanOrEqual(2);
      release();
      const results=await settled;
      for(const result of results) {
        expect(result.status).toBe('fulfilled');
        if(result.status==='fulfilled') {
          expect(result.value.status()).toBeLessThan(500);
          expect(await result.value.text()).not.toMatch(/\d+:E\{"digest":"\d+"/);
        }
      }
      for(const listing of [a.listing,b.listing]) {
        const [report]=await sql`SELECT count(*)::int n FROM listing_reports WHERE listing_id=${listing.id} AND status='open'`;
        const [state]=await sql`SELECT status FROM listings WHERE id=${listing.id}`;
        const [audit]=await sql`SELECT count(*)::int n FROM moderation_log WHERE listing_id=${listing.id} AND action='queue' AND is_automated=true`;
        expect(report.n).toBe(existingCount+1);
        expect(state.status).toBe(existingCount===4?'pending_review':'active');
        expect(audit.n).toBe(existingCount===4?1:0);
      }
      const duplicate=await page.request.post(actionA.url,{data:actionA.data,headers:actionA.headers});
      expect(duplicate.status()).toBeLessThan(500);
      expect(await duplicate.text()).not.toMatch(/\d+:E\{"digest":"\d+"/);
      const [dedup]=await sql`SELECT count(*)::int n FROM listing_reports WHERE listing_id=${b.listing.id}`;
      expect(dedup.n).toBe(existingCount+1);
    } finally {
      release?.();
      await blocker?.catch(()=>{});
      await settled?.catch(()=>{});
      await contextB.close();
      await sql`DELETE FROM listing_reports WHERE listing_id IN (${a.listing.id},${b.listing.id})`;
      await cleanup(a);
      await cleanup(b);
    }
  });
}

for(const schedule of ['report-first','closure-first'] as const) {
  test(`fifth report and account closure serialize in ${schedule} order`,async({page})=>{
    const target=await fixture();
    const reporter=await fixture();
    let release!:()=>void;
    let ready!:()=>void;
    const gate=new Promise<void>(resolve=>{release=resolve;});
    const held=new Promise<void>(resolve=>{ready=resolve;});
    let blocker:Promise<unknown>|undefined;
    let request:Promise<Awaited<ReturnType<typeof page.request.post>>>|undefined;
    let closure:Promise<unknown>|undefined;
    try {
      for(let i=0;i<4;i++) await sql`INSERT INTO listing_reports(listing_id,reporter_anon_id,reason)
        VALUES (${target.listing.id},${`${target.tag}-close-${i}`},'fraud')`;
      await login(page,reporter.owner.email);
      await page.goto(`/used-cars/${target.listing.slug}-${target.listing.id}`);
      await page.getByRole('button',{name:'Report this ad'}).click();
      await page.locator('select[name="reason"]').selectOption('fraud');
      const action=await capture(page,()=>page.getByRole('button',{name:'Send report'}).click());
      blocker=sql.begin(async tx=>{
        if(schedule==='report-first') await tx`SELECT id FROM listings WHERE id=${target.listing.id} FOR UPDATE`;
        else await tx`SELECT id FROM users WHERE id=${target.owner.id} FOR UPDATE`;
        ready();
        await gate;
      });
      await held;
      if(schedule==='report-first') {
        request=page.request.post(action.url,{data:action.data,headers:action.headers,timeout:15000});
        await waitForLock('FROM "listings"');
        closure=closeAccount(sql,target.owner.id);
        await waitForLock('FROM users WHERE id=');
      } else {
        closure=closeAccount(sql,target.owner.id);
        await waitForLock('FROM users WHERE id=');
        request=page.request.post(action.url,{data:action.data,headers:action.headers,timeout:15000});
        await waitForLock('FROM "users"');
      }
      release();
      const [response]=await Promise.all([request,closure,blocker]);
      expect(response.status()).toBeLessThan(500);
      expect(await response.text()).not.toMatch(/\d+:E\{"digest":"\d+"/);
      const [owner]=await sql`SELECT closed_at FROM users WHERE id=${target.owner.id}`;
      const [listing]=await sql`SELECT status FROM listings WHERE id=${target.listing.id}`;
      const [reports]=await sql`SELECT count(*)::int n FROM listing_reports WHERE listing_id=${target.listing.id}`;
      const [audit]=await sql`SELECT count(*)::int n FROM moderation_log WHERE listing_id=${target.listing.id} AND action='queue' AND is_automated=true`;
      expect(owner.closed_at).toBeTruthy();
      expect(listing.status).toBe('removed');
      expect(reports.n).toBe(schedule==='report-first'?5:4);
      expect(audit.n).toBe(schedule==='report-first'?1:0);
    } finally {
      release?.();
      await blocker?.catch(()=>{});
      await Promise.allSettled([request,closure].filter((value):value is NonNullable<typeof value>=>Boolean(value)));
      await sql`DELETE FROM listing_reports WHERE listing_id=${target.listing.id}`;
      await cleanup(target);
      await cleanup(reporter);
    }
  });
}

test('concurrent account closure and vehicle edit finish without deadlock',async({page})=>{
  const f=await fixture();
  try {
    await login(page,f.owner.email,`/dashboard/listings/${f.listing.id}/edit`);
    const request=await capture(page,()=>page.getByRole('button',{name:'Save advertisement changes'}).click());
    const [edit,closure]=await Promise.allSettled([
      page.request.post(request.url,{data:request.data,headers:request.headers,timeout:15000}),
      closeAccount(sql,f.owner.id),
    ]);
    expect(edit.status).toBe('fulfilled');
    expect(closure.status).toBe('fulfilled');
    if(edit.status==='fulfilled') expect(edit.value.status()).toBeLessThan(500);
    const [account]=await sql`SELECT closed_at FROM users WHERE id=${f.owner.id}`;
    const [listing]=await sql`SELECT status FROM listings WHERE id=${f.listing.id}`;
    expect(account.closed_at).toBeTruthy();
    expect(listing.status).toBe('removed');
  } finally {await cleanup(f);}
});

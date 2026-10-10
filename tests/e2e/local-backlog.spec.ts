import { expect, test, type Page } from "@playwright/test";
import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import postgres from "postgres";
import sharp from "sharp";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !/(?:_test|_acceptance)$/.test(new URL(databaseUrl).pathname.slice(1))) {
  throw new Error("Local backlog browser checks require an isolated test database");
}
const sql = postgres(databaseUrl, { max: 3 });
test.afterAll(async () => { await sql.end(); });

async function signIn(page: Page, email: string, next = "/dashboard") {
  await page.context().clearCookies();
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByRole("textbox", { name: "Email or mobile number" }).fill(email);
  await page.getByLabel("Password").fill("AcceptanceOnly123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(url => url.pathname === next);
}

function sessionHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

test.describe("local backlog", () => {

test("sign-out, expired and tampered sessions cannot reopen seller pages", async ({ page, isMobile }) => {
  const email = `acceptance-seller-${isMobile ? "mobile" : "desktop"}@example.invalid`;
  await signIn(page, email);
  const first = (await page.context().cookies()).find(cookie => cookie.name === "jw_session");
  expect(first?.value).toBeTruthy();
  if (isMobile) await page.locator("header details > summary:visible").click();
  const menu = page.locator("header div.group.relative:visible").filter({ has: page.getByRole("button", { name: "Sign out", includeHidden: true }) });
  await menu.locator(":scope > button").focus();
  await menu.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect((await sql`SELECT count(*)::int n FROM sessions WHERE id=${sessionHash(first!.value)}`)[0].n).toBe(0);
  const replay = await page.request.get("/dashboard", { headers: { cookie: `jw_session=${first!.value}` }, maxRedirects: 0 });
  expect(replay.status()).toBeGreaterThanOrEqual(300);
  expect(replay.headers().location).toContain("/login");

  await signIn(page, email);
  const second = (await page.context().cookies()).find(cookie => cookie.name === "jw_session");
  expect(second?.value).toBeTruthy();
  try {
    await sql`UPDATE sessions SET expires_at=NOW()-INTERVAL '1 second' WHERE id=${sessionHash(second!.value)}`;
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await page.context().addCookies([{ ...second!, value: randomBytes(32).toString("base64url") }]);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
  } finally {
    await sql`DELETE FROM sessions WHERE id=${sessionHash(second!.value)}`;
  }
});

test("reordered facets redirect to one canonical URL and unknown facets 404", async ({ request }) => {
  const [city] = await sql`SELECT slug FROM cities WHERE slug='lahore' LIMIT 1`;
  const [carMake] = await sql`SELECT slug FROM makes WHERE vertical='car' AND slug='toyota' LIMIT 1`;
  const [bikeMake] = await sql`SELECT slug FROM makes WHERE vertical='bike' AND slug='honda' LIMIT 1`;
  const [category] = await sql`SELECT slug FROM part_categories WHERE parent_id IS NULL ORDER BY id LIMIT 1`;
  expect(city && carMake && bikeMake && category).toBeTruthy();
  for (const [base, facet] of [["used-cars", carMake.slug], ["used-bikes", bikeMake.slug], ["auto-parts", category.slug]] as const) {
    const response = await request.get(`/${base}/${city.slug}/${facet}?sort=price_asc&page=2`, { maxRedirects: 0 });
    expect(response.status(), base).toBe(308);
    const destination = new URL(response.headers().location, "http://127.0.0.1:3101");
    expect(destination.pathname).toBe(`/${base}/${facet}/${city.slug}`);
    expect(destination.searchParams.get("sort")).toBe("price_asc");
    expect(destination.searchParams.get("page")).toBe("2");
    expect((await request.get(`/${base}/${facet}/${city.slug}/not-a-real-facet`)).status()).toBe(404);
  }
});

test("car, bike and part details show correct metadata, specs and a delivered photo", async ({ page }) => {
  const uploadDir = process.env.UPLOAD_DIR;
  if (!uploadDir) throw new Error("UPLOAD_DIR is required for detail acceptance");
  for (const [vertical, base, heading] of [["car", "used-cars", "Car details"], ["bike", "used-bikes", "Bike details"], ["part", "auto-parts", "Part details"]] as const) {
    const tag = randomBytes(8).toString("hex");
    const [owner] = await sql`INSERT INTO users(email,name,email_verified_at) VALUES (${`detail-${tag}@example.invalid`},'Detail fixture seller',NOW()) RETURNING id`;
    let listingId: number | undefined;
    const key = `202610/${randomBytes(16).toString("hex")}.webp`;
    const file = join(uploadDir, key);
    try {
      const [source] = await sql`SELECT id FROM listings WHERE vertical=${vertical} AND status='active' AND seller_deleted_at IS NULL ORDER BY id LIMIT 1`;
      expect(source?.id).toBeGreaterThan(0);
      const title = `Acceptance ${vertical} ${tag}`;
      const slug = `acceptance-${vertical}-${tag}`;
      const [listing] = await sql`INSERT INTO listings(vertical,seller_id,slug,title,description,price_pkr,city_id,status,make_id,model_id,variant_id,year,mileage_km,transmission,fuel,body_type,engine_cc,assembly,published_at,expires_at,photo_count)
        SELECT vertical,${owner.id},${slug},${title},description,price_pkr,city_id,'active',make_id,model_id,variant_id,year,mileage_km,transmission,fuel,body_type,engine_cc,assembly,NOW(),NOW()+INTERVAL '30 days',1
        FROM listings WHERE id=${source.id} RETURNING id,slug,title,year`;
      listingId = listing.id;
      if (vertical === "car") await sql`INSERT INTO car_details(listing_id) VALUES (${listing.id})`;
      if (vertical === "bike") await sql`INSERT INTO bike_details(listing_id) VALUES (${listing.id})`;
      if (vertical === "part") await sql`INSERT INTO part_details(listing_id,category_id,condition,brand)
        SELECT ${listing.id},category_id,condition,${`FixtureBrand${tag}`} FROM part_details WHERE listing_id=${source.id}`;
      const bytes = await sharp({ create: { width: 32, height: 24, channels: 3, background: "#557799" } }).webp().toBuffer();
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, bytes);
      await sql`INSERT INTO listing_images(listing_id,storage_key,position,width,height) VALUES (${listing.id},${key},0,32,24)`;
      const path = `/${base}/${listing.slug}-${listing.id}`;
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: listing.title })).toBeVisible();
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
      expect(await page.title()).toContain(listing.title);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`${path.replaceAll("/", "\\/")}$`));
      if (vertical === "part") {
        await expect(page.getByText("Brand", { exact: true }).locator("..").locator("dd")).toHaveText(`FixtureBrand${tag}`);
      } else {
        await expect(page.getByText("Model Year", { exact: true }).locator("..").locator("dd")).toHaveText(String(listing.year));
      }
      const image = page.getByRole("img", { name: listing.title }).first();
      await expect(image).toHaveAttribute("src", `/uploads/${key}`);
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).complete && (element as HTMLImageElement).naturalWidth > 0)).toBe(true);
      const delivered = await page.request.get(`/uploads/${key}`);
      expect(delivered.status()).toBe(200);
      expect(delivered.headers()["content-type"]).toContain("image/webp");
    } finally {
      if (listingId) await sql`DELETE FROM listings WHERE id=${listingId}`;
      await sql`DELETE FROM users WHERE id=${owner.id}`;
      await rm(file, { force: true });
    }
  }
});

test("two sellers registering the same dealer name receive unique permanent slugs", async ({ page }) => {
  const tag = `Duplicate Motors ${randomBytes(5).toString("hex")}`;
  const root = tag.toLowerCase().replaceAll(" ", "-");
  const [seed] = await sql`SELECT password_hash FROM users WHERE email='acceptance-seller@example.invalid'`;
  const accounts = await sql`INSERT INTO users(email,name,password_hash,email_verified_at) VALUES
    (${root+'-a@example.invalid'},'Dealer A',${seed.password_hash},NOW()),
    (${root+'-b@example.invalid'},'Dealer B',${seed.password_hash},NOW()) RETURNING id,email`;
  try {
    for (const account of accounts) {
      await page.context().clearCookies();
      await signIn(page, account.email, "/dealers/register");
      await page.locator('input[name="businessName"]').fill(tag);
      await page.locator('select[name="cityId"]').selectOption({ index: 1 });
      await page.getByRole("button", { name: "Create dealer account" }).click();
      await expect(page).toHaveURL(/\/dashboard\/dealer(?:\?|$)/);
    }
    const dealers = await sql`SELECT d.slug,u.type FROM dealers d JOIN users u ON u.id=d.user_id WHERE u.id IN (${accounts[0].id},${accounts[1].id}) ORDER BY d.slug`;
    expect(dealers.map(dealer => dealer.slug)).toEqual([root, `${root}-2`]);
    expect(dealers.map(dealer => dealer.type)).toEqual(["dealer", "dealer"]);
    await page.goto("/dealers/register");
    await expect(page).toHaveURL(/\/dashboard\/dealer(?:\?|$)/);
    expect((await sql`SELECT count(*)::int n FROM dealers WHERE user_id IN (${accounts[0].id},${accounts[1].id})`)[0].n).toBe(2);
  } finally {
    await sql`DELETE FROM sessions WHERE user_id IN (${accounts[0].id},${accounts[1].id})`;
    await sql`DELETE FROM dealers WHERE user_id IN (${accounts[0].id},${accounts[1].id})`;
    await sql`DELETE FROM users WHERE id IN (${accounts[0].id},${accounts[1].id})`;
  }
});

test("concurrent same-name dealer registration claims distinct slugs without a server error", async ({ page, browser }) => {
  const tag = `Concurrent Motors ${randomBytes(5).toString("hex")}`;
  const root = tag.toLowerCase().replaceAll(" ", "-");
  const [seed] = await sql`SELECT password_hash FROM users WHERE email='acceptance-seller@example.invalid'`;
  const accounts = await sql`INSERT INTO users(email,name,password_hash,email_verified_at) VALUES
    (${root+'-a@example.invalid'},'Concurrent Dealer A',${seed.password_hash},NOW()),
    (${root+'-b@example.invalid'},'Concurrent Dealer B',${seed.password_hash},NOW()) RETURNING id,email`;
  const secondContext = await browser.newContext({ baseURL: process.env.ACCEPTANCE_BASE_URL ?? "http://127.0.0.1:3101" });
  const secondPage = await secondContext.newPage();
  let release: (() => void) | undefined;
  let blocker: Promise<unknown> | undefined;
  let firstSubmit: Promise<void> | undefined;
  let secondSubmit: Promise<void> | undefined;
  try {
    await signIn(page, accounts[0].email, "/dealers/register");
    await signIn(secondPage, accounts[1].email, "/dealers/register");
    for (const entry of [page, secondPage]) {
      await entry.locator('input[name="businessName"]').fill(tag);
      await entry.locator('select[name="cityId"]').selectOption({ index: 1 });
    }
    let ready!: () => void;
    const held = new Promise<void>(resolve => { ready = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    let blockerPid = 0;
    blocker = sql.begin(async tx => {
      const [backend] = await tx`SELECT pg_backend_pid() pid`;
      blockerPid = backend.pid;
      await tx`SELECT id FROM users WHERE id=${accounts[0].id} FOR UPDATE`;
      ready();
      await gate;
    });
    await held;
    firstSubmit = page.getByRole("button", { name: "Create dealer account" }).click();
    await expect.poll(async () => {
      const [row] = await sql`SELECT count(*)::int n FROM pg_stat_activity
        WHERE datname=current_database() AND wait_event_type='Lock'
          AND ${blockerPid}=ANY(pg_blocking_pids(pid)) AND query ILIKE '%insert into "dealers"%'`;
      return row.n;
    }, { timeout: 15000 }).toBeGreaterThan(0);
    secondSubmit = secondPage.getByRole("button", { name: "Create dealer account" }).click();
    await expect.poll(async () => {
      const [row] = await sql`SELECT count(*)::int n FROM pg_stat_activity
        WHERE datname=current_database() AND wait_event_type='Lock' AND query ILIKE '%insert into "dealers"%'`;
      return row.n;
    }, { timeout: 15000 }).toBeGreaterThanOrEqual(2);
    release!();
    await Promise.all([blocker, firstSubmit, secondSubmit]);
    await expect(page).toHaveURL(/\/dashboard\/dealer(?:\?|$)/);
    await expect(secondPage).toHaveURL(/\/dashboard\/dealer(?:\?|$)/);
    const rows = await sql`SELECT d.user_id,d.slug,u.type FROM dealers d JOIN users u ON u.id=d.user_id
      WHERE u.id IN (${accounts[0].id},${accounts[1].id}) ORDER BY d.slug`;
    expect(rows.map(row => row.slug)).toEqual([root, `${root}-2`]);
    expect(rows.map(row => row.user_id).sort()).toEqual(accounts.map(account => account.id).sort());
    expect(rows.map(row => row.type)).toEqual(["dealer", "dealer"]);
    for (const entry of [page, secondPage]) {
      await entry.goto("/dealers/register");
      await expect(entry).toHaveURL(/\/dashboard\/dealer(?:\?|$)/);
    }
    expect((await sql`SELECT count(*)::int n FROM dealers WHERE user_id IN (${accounts[0].id},${accounts[1].id})`)[0].n).toBe(2);
  } finally {
    release?.();
    await blocker?.catch(() => {});
    await firstSubmit?.catch(() => {});
    await secondSubmit?.catch(() => {});
    await secondContext.close();
    await sql`DELETE FROM sessions WHERE user_id IN (${accounts[0].id},${accounts[1].id})`;
    await sql`DELETE FROM dealers WHERE user_id IN (${accounts[0].id},${accounts[1].id})`;
    await sql`DELETE FROM users WHERE id IN (${accounts[0].id},${accounts[1].id})`;
  }
});

for (const service of ["inspection", "assistance"] as const) {
  test(`${service} admin follows every intermediate lifecycle step with auditable customer history`, async ({ page, isMobile }) => {
    const email = `acceptance-seller-${isMobile ? "mobile" : "desktop"}@example.invalid`;
    const [owner] = await sql`SELECT id FROM users WHERE email=${email}`;
    const [city] = await sql`SELECT id FROM cities ORDER BY id LIMIT 1`;
    const [admin] = await sql`SELECT id FROM users WHERE email='acceptance-admin@example.invalid'`;
    const [model] = await sql`SELECT id,make_id FROM models WHERE vertical='car' ORDER BY id LIMIT 1`;
    const tag = `Lifecycle ${service} ${randomBytes(6).toString("hex")}`;
    const request = service === "inspection"
      ? (await sql`INSERT INTO inspections(requested_by_user_id,city_id,address,contact_phone) VALUES (${owner.id},${city.id},${tag},'+923009998881') RETURNING id`)[0]
      : (await sql`INSERT INTO sell_assistance_requests(requested_by_user_id,city_id,make_id,model_id,year,mileage_km,registration_city,ownership_status,vehicle_condition,selling_timeline,address,contact_phone) VALUES (${owner.id},${city.id},${model.make_id},${model.id},2020,12000,'Lahore','own_name','good','within_month',${tag},'+923009998881') RETURNING id`)[0];
    const table = service === "inspection" ? "inspections" : "sell_assistance_requests";
    const eventTable = service === "inspection" ? "inspection_events" : "sell_assistance_events";
    const key = service === "inspection" ? "inspection_id" : "request_id";
    const input = service === "inspection" ? "inspectionId" : "requestId";
    const route = service === "inspection" ? "inspections" : "sell-assistance";
    const statuses = service === "inspection"
      ? ["contacted", "confirmed", "completed"]
      : ["contacted", "details_confirmed", "ad_preparation", "ad_live", "buyer_follow_up", "ad_live", "sold"];
    const messages: string[] = [];
    let previous = "requested";
    try {
      await signIn(page, "acceptance-admin@example.invalid", `/admin/${route}`);
      for (const [index, next] of statuses.entries()) {
        await page.goto(`/admin/${route}`);
        const form = page.locator("form").filter({ has: page.locator(`input[name="${input}"][value="${request.id}"]`) });
        await expect(form.locator('select[name="status"]')).toHaveValue(previous);
        const message = `${tag} customer step ${index + 1}`;
        const note = `${tag} private step ${index + 1}`;
        await form.locator('select[name="status"]').selectOption(next);
        await form.locator('textarea[name="customerMessage"]').fill(message);
        await form.locator('textarea[name="internalNote"]').fill(note);
        await form.getByRole("button", { name: "Save update" }).click();
        await expect(form.getByRole("status")).toHaveText("Update saved and audited.");
        const [state] = await sql`SELECT status FROM ${sql(table)} WHERE id=${request.id}`;
        const events = await sql`SELECT actor_user_id,from_status,to_status,customer_message,internal_note FROM ${sql(eventTable)} WHERE ${sql(key)}=${request.id} ORDER BY id`;
        expect(state.status).toBe(next);
        expect(events).toHaveLength(index + 1);
        expect(events[index]).toMatchObject({ actor_user_id: admin.id, from_status: previous, to_status: next, customer_message: message, internal_note: note });
        messages.push(message);
        previous = next;
      }
      await signIn(page, email, `/dashboard/${route}`);
      for (const message of messages) await expect(page.getByText(message, { exact: true })).toBeVisible();
      await expect(page.getByText(`${tag} private step 1`, { exact: true })).toHaveCount(0);
    } finally {
      await sql`DELETE FROM ${sql(table)} WHERE id=${request.id}`;
    }
  });
}
});

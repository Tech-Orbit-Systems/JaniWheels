import { expect, test, type Page, type Request } from "@playwright/test";
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";
import sharp from "sharp";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !/(?:_test|_acceptance)$/.test(new URL(databaseUrl).pathname.slice(1))) {
  throw new Error("Authorization acceptance requires an isolated test database");
}
const sql = postgres(databaseUrl, { max: 1 });
test.afterAll(async () => { await sql.end(); });

for (const service of ["inspection", "assistance"] as const) {
  test(`${service} administration replay enforces roles, transitions and customer privacy`, async ({ page, isMobile }) => {
    const email = `acceptance-seller-${isMobile ? "mobile" : "desktop"}@example.invalid`;
    const [owner] = await sql`SELECT id FROM users WHERE email = ${email}`;
    const [city] = await sql`SELECT id FROM cities ORDER BY id LIMIT 1`;
    const table = service === "inspection" ? "inspections" : "sell_assistance_requests";
    const eventTable = service === "inspection" ? "inspection_events" : "sell_assistance_events";
    const eventKey = service === "inspection" ? "inspection_id" : "request_id";
    const inputName = service === "inspection" ? "inspectionId" : "requestId";
    const route = service === "inspection" ? "inspections" : "sell-assistance";
    const fixture = `Authorization ${randomBytes(6).toString("hex")}`;
    let id: number;
    if (service === "inspection") {
      const [row] = await sql`INSERT INTO inspections (requested_by_user_id,city_id,address,contact_phone) VALUES (${owner.id},${city.id},${fixture},'+923009998881') RETURNING id`;
      id = Number(row.id);
    } else {
      const [model] = await sql`SELECT id,make_id FROM models ORDER BY id LIMIT 1`;
      const [row] = await sql`INSERT INTO sell_assistance_requests (requested_by_user_id,city_id,make_id,model_id,year,mileage_km,registration_city,ownership_status,vehicle_condition,selling_timeline,address,contact_phone) VALUES (${owner.id},${city.id},${model.make_id},${model.id},2020,10000,'Lahore','own_name','good','within_month',${fixture},'+923009998881') RETURNING id`;
      id = Number(row.id);
    }
    const snapshot = async () => ({
      rows: await sql`SELECT status,updated_at FROM ${sql(table)} WHERE id=${id}`,
      events: await sql`SELECT * FROM ${sql(eventTable)} WHERE ${sql(eventKey)}=${id} ORDER BY id`,
    });
    const message = `Customer-visible ${fixture}`;
    const note = `Private ${fixture}`;
    try {
      await signIn(page, "acceptance-admin@example.invalid", `/admin/${route}`);
      const form = page.locator("form").filter({ has: page.locator(`input[name="${inputName}"][value="${id}"]`) });
      await form.locator('select[name="status"]').selectOption("contacted");
      await form.locator('textarea[name="customerMessage"]').fill(message);
      await form.locator('textarea[name="internalNote"]').fill(note);
      const request = await captureAction(page, () => form.getByRole("button", { name: "Save update" }).click());
      const before = await snapshot();
      for (const actor of [email, "acceptance-seller@example.invalid", null]) {
        if (actor) await signIn(page, actor); else await page.context().clearCookies();
        const response = await replay(page, request);
        expect(response.status()).toBe(303);
        expect(response.headers()["x-action-redirect"]).toContain(actor ? "/;" : "/login");
        expect(await snapshot()).toEqual(before);
      }
      await signIn(page, "acceptance-admin@example.invalid");
      const payload = request.data.toString();
      expect(payload).toContain("contacted");
      expect(payload).toContain(message);
      for (const [data, error] of [
        [payload.replaceAll("contacted", service === "inspection" ? "completed" : "sold"), "cannot move"],
        [payload.replaceAll(message, ""), service === "inspection" ? "customer update" : "customer-visible update"],
      ]) {
        const response = await replay(page, { ...request, data: Buffer.from(data) });
        expect(response.status()).toBe(200);
        expect(await response.text()).toContain(error);
        expect(await snapshot()).toEqual(before);
      }
      expect((await replay(page, request)).status()).toBe(200);
      const after = await snapshot();
      expect(after.rows[0].status).toBe("contacted");
      expect(after.events).toHaveLength(1);
      expect(after.events[0]).toMatchObject({ from_status: "requested", to_status: "contacted", customer_message: message, internal_note: note });
      await signIn(page, email, `/dashboard/${route}`);
      await expect(page.getByText(message, { exact: true })).toBeVisible();
      await expect(page.getByText(note, { exact: true })).toHaveCount(0);
      await signIn(page, "acceptance-seller@example.invalid", `/dashboard/${route}`);
      await expect(page.getByText(message, { exact: true })).toHaveCount(0);
      await expect(page.getByText(fixture, { exact: true })).toHaveCount(0);
      await sql`UPDATE ${sql(table)} SET status=${service === "inspection" ? "completed" : "sold"} WHERE id=${id}`;
      const terminal = await snapshot();
      await signIn(page, "acceptance-admin@example.invalid");
      const denied = await replay(page, request);
      expect(await denied.text()).toContain("cannot move");
      expect(await snapshot()).toEqual(terminal);
    } finally {
      await sql`DELETE FROM ${sql(table)} WHERE id=${id}`;
    }
  });
}

test("dealer verification replay denies sellers and anonymous users with admin controls", async ({ page }) => {
  const slug = `authorization-${randomBytes(6).toString("hex")}`;
  const [owner] = await sql`INSERT INTO users (email,name) VALUES (${`${slug}@example.invalid`},'Dealer authorization fixture') RETURNING id`;
  const [city] = await sql`SELECT id FROM cities ORDER BY id LIMIT 1`;
  const [dealer] = await sql`INSERT INTO dealers (user_id,business_name,slug,city_id) VALUES (${owner.id},${slug},${slug},${city.id}) RETURNING id`;
  const snapshot = async () => ({
    dealer: await sql`SELECT verified_at FROM dealers WHERE id=${dealer.id}`,
    audit: await sql`SELECT * FROM moderation_log WHERE user_id=${owner.id} ORDER BY id`,
  });
  try {
    for (const button of ["Verify dealer", "Revoke verification"]) {
      await signIn(page, "acceptance-admin@example.invalid", "/admin/dealers");
      const row = page.locator("li").filter({ has: page.locator(`a[href="/dealers/${slug}"]`) });
      await row.locator("textarea").fill("Authorization fixture decision");
      const request = await captureAction(page, () => row.getByRole("button", { name: button, exact: true }).click());
      const before = await snapshot();
      for (const actor of ["acceptance-seller@example.invalid", null]) {
        if (actor) await signIn(page, actor); else await page.context().clearCookies();
        const denied = await replay(page, request);
        expect(denied.status()).toBe(303);
        expect(denied.headers()["x-action-redirect"]).toContain(actor ? "/;" : "/login");
        expect(await snapshot()).toEqual(before);
      }
      await signIn(page, "acceptance-admin@example.invalid");
      expect((await replay(page, request)).status()).toBe(200);
      const after = await snapshot();
      expect(Boolean(after.dealer[0].verified_at)).toBe(button === "Verify dealer");
      expect(after.audit).toHaveLength(before.audit.length + 1);
      expect(after.audit.at(-1)?.action).toBe(button === "Verify dealer" ? "dealer_verify" : "dealer_revoke");
    }
  } finally {
    await sql`DELETE FROM moderation_log WHERE user_id=${owner.id}`;
    await sql`DELETE FROM dealers WHERE id=${dealer.id}`;
    await sql`DELETE FROM users WHERE id=${owner.id}`;
  }
});

test("expiry cron and reactivation enforce ownership and a fresh thirty-day window", async ({ page, isMobile }) => {
  const email = `acceptance-seller-${isMobile ? "mobile" : "desktop"}@example.invalid`;
  const [owner] = await sql`SELECT id FROM users WHERE email=${email}`;
  const [city] = await sql`SELECT id FROM cities ORDER BY id LIMIT 1`;
  const fixture = `expiry-${randomBytes(6).toString("hex")}`;
  const rows = await sql`INSERT INTO listings (vertical,seller_id,slug,title,price_pkr,city_id,status,published_at,expires_at)
    VALUES ('part',${owner.id},${fixture},${fixture},2500,${city.id},'active',NOW()-INTERVAL '31 days',NOW()-INTERVAL '1 minute'),
           ('part',${owner.id},${`${fixture}-future`},${fixture},2500,${city.id},'active',NOW(),NOW()+INTERVAL '1 day') RETURNING id`;
  const id = Number(rows[0].id);
  const snapshot = async () => (await sql`SELECT status,published_at,expires_at,sold_at FROM listings WHERE id=${id}`)[0];
  try {
    expect(process.env.CRON_SECRET).toBeTruthy();
    expect((await page.request.post("/api/cron/expire-listings")).status()).toBe(401);
    expect((await snapshot()).status).toBe("active");
    expect((await page.request.post("/api/cron/expire-listings", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } })).status()).toBe(200);
    expect((await snapshot()).status).toBe("expired");
    expect((await sql`SELECT status FROM listings WHERE id=${rows[1].id}`)[0].status).toBe("active");
    await signIn(page, email);
    const row = page.locator("li").filter({ has: page.locator(`a[href="/dashboard/listings/${id}/edit"]`) });
    const request = await captureAction(page, () => row.getByRole("button", { name: "Reactivate for 30 days" }).click());
    const before = await snapshot();
    await signIn(page, "acceptance-seller@example.invalid");
    expect((await replay(page, request)).status()).toBe(200);
    expect(await snapshot()).toEqual(before);
    await page.context().clearCookies();
    expect((await replay(page, request)).status()).toBe(303);
    expect(await snapshot()).toEqual(before);
    await signIn(page, email);
    expect((await replay(page, request)).status()).toBe(200);
    const after = await snapshot();
    expect(after.status).toBe("active");
    expect(after.sold_at).toBeNull();
    expect(new Date(after.published_at).getTime()).toBeGreaterThan(new Date(before.published_at).getTime());
    expect(new Date(after.expires_at).getTime() - new Date(after.published_at).getTime()).toBe(30 * 86_400_000);
    for (const state of ["active", "rejected", "removed"]) {
      await sql`UPDATE listings SET status=${state} WHERE id=${id}`;
      const blocked = await snapshot();
      await replay(page, request);
      expect(await snapshot()).toEqual(blocked);
    }
  } finally {
    await sql`DELETE FROM listings WHERE id IN (${id},${rows[1].id})`;
  }
});

test("uploaded photos enforce read visibility and reject foreign publish and edit keys", async ({ page, isMobile }) => {
  const ownerEmail = `acceptance-seller-${isMobile ? "mobile" : "desktop"}@example.invalid`;
  const keys: string[] = [];
  let listingId: number | undefined;
  const photo = await sharp({ create: { width: 24, height: 24, channels: 3, background: "#487654" } }).png().toBuffer();
  async function cookie() {
    const session = (await page.context().cookies()).find((item) => item.name === "jw_session");
    return session ? `jw_session=${session.value}` : "";
  }
  async function upload() {
    const response = await page.request.post("/api/upload", {
      headers: { cookie: await cookie() },
      multipart: { files: { name: "private.png", mimeType: "image/png", buffer: photo } },
    });
    expect(response.status()).toBe(200);
    const { keys: uploaded } = await response.json();
    expect(uploaded).toHaveLength(1);
    keys.push(uploaded[0]);
    return uploaded[0] as string;
  }
  async function reads(key: string, status: number) {
    for (const method of ["GET", "HEAD"]) {
      const response = await page.request.fetch(`/uploads/${key}`, { method, headers: { cookie: await cookie() } });
      expect(response.status()).toBe(status);
      expect(response.headers()["cache-control"]).toContain("no-store");
    }
  }
  try {
    await signIn(page, "acceptance-seller@example.invalid");
    const foreignKey = await upload();
    await reads(foreignKey, 200);
    await signIn(page, ownerEmail, "/sell/part");
    await reads(foreignKey, 404);
    const ownKey = await upload();
    await reads(ownKey, 200);
    const optimizer = await page.request.get(`/_next/image?url=${encodeURIComponent(`/uploads/${ownKey}`)}&w=640&q=75`, { headers: { cookie: await cookie() } });
    expect(optimizer.status()).toBe(400);
    await page.locator('select[name="categoryId"]').selectOption({ index: 1 });
    await page.locator('input[name="brand"]').fill("Media authorization fixture");
    await page.locator('input[name="pricePkr"]').fill("2500");
    await page.locator('select[name="cityId"]').selectOption({ index: 1 });
    // Submit a real valid browser form, replacing only its photo reference for the attack.
    await page.locator('input[type="file"]').setInputFiles({ name: "publish.png", mimeType: "image/png", buffer: photo });
    await expect(page.getByText("1 photo added")).toBeVisible();
    const publishKey = await page.locator('input[name="imageKeys"]').inputValue();
    keys.push(publishKey);
    const publish = await captureAction(page, () => page.getByRole("button", { name: "Post Auto Part Ad — Free" }).click());
    const [owner] = await sql`SELECT id FROM users WHERE email = ${ownerEmail}`;
    const before = await sql`SELECT id FROM listings WHERE seller_id = ${owner.id} ORDER BY id`;
    const payload = publish.data.toString();
    expect(payload).toContain(publishKey);
    const denied = await replay(page, { ...publish, data: Buffer.from(payload.replaceAll(publishKey, foreignKey)) });
    expect(await denied.text()).toContain("belong to another account");
    expect(await sql`SELECT id FROM listings WHERE seller_id = ${owner.id} ORDER BY id`).toEqual(before);
    expect((await sql`SELECT claimed_at FROM pending_uploads WHERE storage_key = ${foreignKey}`)[0].claimed_at).toBeNull();
    expect((await replay(page, publish)).status()).toBe(303);
    const [created] = await sql`SELECT id FROM listings WHERE seller_id = ${owner.id} ORDER BY id DESC LIMIT 1`;
    listingId = Number(created.id);

    await page.goto(`/dashboard/listings/${listingId}/edit`);
    await expect(page.getByAltText("Ad photo 1")).toBeVisible();
    await expect.poll(() => page.getByAltText("Ad photo 1").evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    const edit = await captureAction(page, () => page.getByRole("button", { name: "Save advertisement changes" }).click());
    expect(edit.data.toString()).toContain(publishKey);
    const editDenied = await replay(page, { ...edit, data: Buffer.from(edit.data.toString().replaceAll(publishKey, foreignKey)) });
    expect(await editDenied.text()).toContain("belong to another account");
    expect((await sql`SELECT storage_key FROM listing_images WHERE listing_id = ${listingId}`).map((row) => row.storage_key)).toEqual([publishKey]);
    expect((await replay(page, edit)).status()).toBe(303);

    await page.context().clearCookies();
    await reads(ownKey, 404);
    await reads(publishKey, 200);
    for (const status of ["draft", "pending_review", "sold", "expired", "rejected", "removed"]) {
      await sql`UPDATE listings SET status = ${status} WHERE id = ${listingId}`;
      await reads(publishKey, 404);
    }
    await signIn(page, "acceptance-seller@example.invalid");
    await reads(publishKey, 404);
    await signIn(page, ownerEmail);
    await reads(publishKey, 200);
    await signIn(page, "acceptance-admin@example.invalid");
    await reads(publishKey, 200);
    await reads(ownKey, 200);
  } finally {
    if (listingId) await sql`DELETE FROM listings WHERE id = ${listingId}`;
    for (const key of keys) {
      await sql`DELETE FROM pending_uploads WHERE storage_key = ${key}`;
      if (process.env.UPLOAD_DIR) await rm(join(process.env.UPLOAD_DIR, key), { force: true });
    }
  }
});

async function signIn(page: Page, email: string, next = "/dashboard") {
  await page.context().clearCookies();
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByRole("textbox", { name: "Email or mobile number" }).fill(email);
  await page.getByLabel("Password").fill("AcceptanceOnly123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL((url) => url.pathname === next);
  await expect.poll(async () => (await page.context().cookies()).some((cookie) => cookie.name === "jw_session")).toBe(true);
}

async function captureAction(page: Page, submit: () => Promise<unknown>) {
  let intercepted!: (request: Request) => void;
  const pending = new Promise<Request>((resolve) => { intercepted = resolve; });
  await page.route("**/*", async (route) => {
    if (route.request().method() === "POST" && route.request().headers()["next-action"]) {
      // The request event precedes routing; wait for abort before removing this handler.
      await route.abort();
      intercepted(route.request());
    } else await route.continue();
  });
  await submit();
  const request = await pending;
  const data = request.postDataBuffer();
  expect(data).toBeTruthy();
  const headers = { ...request.headers() };
  delete headers.cookie;
  delete headers.host;
  delete headers["content-length"];
  await page.unrouteAll({ behavior: "wait" });
  return { url: request.url(), data: data!, headers };
}

async function replay(page: Page, request: Awaited<ReturnType<typeof captureAction>>) {
  // APIRequestContext omits Secure cookies on local HTTP even when Chromium accepts them.
  const session = (await page.context().cookies()).find((cookie) => cookie.name === "jw_session");
  return page.request.post(request.url, {
    data: request.data,
    headers: { ...request.headers, cookie: session ? `jw_session=${session.value}` : "" },
    maxRedirects: 0,
  });
}

test("direct edit replay requires the listing owner and preserves photos", async ({ page, isMobile }) => {
  const email = `acceptance-seller-${isMobile ? "mobile" : "desktop"}@example.invalid`;
  await signIn(page, email, "/sell/part");
  await page.locator('select[name="categoryId"]').selectOption({ index: 1 });
  await page.locator('input[name="brand"]').fill("Authorization fixture");
  await page.locator('input[name="pricePkr"]').fill("2500");
  await page.locator('select[name="cityId"]').selectOption({ index: 1 });
  const photo = await sharp({ create: { width: 24, height: 24, channels: 3, background: "#526274" } }).png().toBuffer();
  await page.locator('input[type="file"]').setInputFiles({ name: "owner-photo.png", mimeType: "image/png", buffer: photo });
  await expect(page.getByText("1 photo added")).toBeVisible();
  await page.getByRole("button", { name: "Post Auto Part Ad — Free" }).click();
  await expect(page).toHaveURL(/\/auto-parts\/.+\?posted=1/);
  const id = Number(/-(\d+)$/.exec(new URL(page.url()).pathname)?.[1]);
  expect(id).toBeGreaterThan(0);
  const images = await sql`SELECT storage_key, position FROM listing_images WHERE listing_id = ${id} ORDER BY position`;
  expect(images).toHaveLength(1);

  try {
    await page.goto(`/dashboard/listings/${id}/edit`);
    await page.locator('input[name="pricePkr"]').fill("3250");
    const request = await captureAction(page, () => page.getByRole("button", { name: "Save advertisement changes" }).click());
    const [before] = await sql`SELECT price_pkr, title, status, updated_at FROM listings WHERE id = ${id}`;
    await signIn(page, "acceptance-seller@example.invalid");
    const denied = await replay(page, request);
    expect(denied.status()).toBe(200);
    expect(await denied.text()).toContain("This ad cannot be edited.");
    expect((await sql`SELECT price_pkr, title, status, updated_at FROM listings WHERE id = ${id}`)[0]).toEqual(before);
    expect(await sql`SELECT storage_key, position FROM listing_images WHERE listing_id = ${id} ORDER BY position`).toEqual(images);

    await page.context().clearCookies();
    const anonymous = await replay(page, request);
    expect(anonymous.status()).toBe(303);
    expect(anonymous.headers()["x-action-redirect"]).toContain("/login");

    // Replaying the same payload as its owner proves denial did not come from an invalid action or form.
    await signIn(page, email);
    expect((await replay(page, request)).status()).toBe(303);
    expect((await sql`SELECT price_pkr FROM listings WHERE id = ${id}`)[0].price_pkr).toBe(3250);
  } finally {
    await sql`DELETE FROM listings WHERE id = ${id}`;
    if (process.env.UPLOAD_DIR) {
      for (const image of images) await rm(join(process.env.UPLOAD_DIR, image.storage_key), { force: true });
    }
  }
});

test("direct administrator replay denies sellers and anonymous visitors", async ({ page, isMobile }) => {
  const email = `authorization-${isMobile ? "mobile" : "desktop"}-${randomBytes(5).toString("hex")}@example.invalid`;
  const [owner] = await sql`INSERT INTO users (email, name) VALUES (${email}, 'Authorization fixture') RETURNING id`;
  const [city] = await sql`SELECT id FROM cities ORDER BY id LIMIT 1`;
  const [listing] = await sql`
    INSERT INTO listings (vertical, seller_id, slug, title, price_pkr, city_id, status, published_at)
    VALUES ('part', ${owner.id}, 'authorization-fixture', 'Authorization fixture', 2500, ${city.id}, 'active', NOW()) RETURNING id
  `;

  try {
    await signIn(page, "acceptance-admin@example.invalid", "/admin/listings");
    const requests: Awaited<ReturnType<typeof captureAction>>[] = [];
    for (const button of ["Flag / hide", "Remove"]) {
      await page.goto("/admin/listings");
      const row = page.locator("article").filter({ has: page.locator(`a[href$="-${listing.id}"]`) });
      await row.locator("textarea").fill("Authorization acceptance review");
      requests.push(await captureAction(page, () => row.getByRole("button", { name: button, exact: true }).click()));
    }
    await page.goto("/admin/users");
    const ownerRow = page.locator("article").filter({ hasText: email });
    await ownerRow.getByPlaceholder("Ban reason (required)").fill("Authorization acceptance ban");
    requests.push(await captureAction(page, () => ownerRow.getByRole("button", { name: "Ban user", exact: true }).click()));
    expect((await sql`SELECT status FROM listings WHERE id = ${listing.id}`)[0].status).toBe("active");
    expect((await sql`SELECT is_banned FROM users WHERE id = ${owner.id}`)[0].is_banned).toBe(false);
    expect(await sql`SELECT id FROM moderation_log WHERE listing_id = ${listing.id} OR user_id = ${owner.id}`).toHaveLength(0);

    await signIn(page, "acceptance-seller@example.invalid");
    for (const authenticated of [true, false]) {
      if (!authenticated) await page.context().clearCookies();
      for (const request of requests) {
        const response = await replay(page, request);
        expect(response.status()).toBe(303);
        expect(response.headers()["x-action-redirect"]).toContain(authenticated ? "/;" : "/login");
        expect((await sql`SELECT status FROM listings WHERE id = ${listing.id}`)[0].status).toBe("active");
        expect((await sql`SELECT is_banned FROM users WHERE id = ${owner.id}`)[0].is_banned).toBe(false);
        expect(await sql`SELECT id FROM moderation_log WHERE listing_id = ${listing.id} OR user_id = ${owner.id}`).toHaveLength(0);
      }
    }

    await signIn(page, "acceptance-admin@example.invalid", "/admin/listings");
    for (const request of requests) expect((await replay(page, request)).status()).toBe(200);
    expect((await sql`SELECT status FROM listings WHERE id = ${listing.id}`)[0].status).toBe("removed");
    expect((await sql`SELECT is_banned FROM users WHERE id = ${owner.id}`)[0].is_banned).toBe(true);
    const audit = await sql`SELECT action FROM moderation_log WHERE listing_id = ${listing.id} OR user_id = ${owner.id} ORDER BY id`;
    expect(audit.map((row) => row.action)).toEqual(["flag", "remove", "ban"]);
  } finally {
    await sql`DELETE FROM moderation_log WHERE listing_id = ${listing.id} OR user_id = ${owner.id}`;
    await sql`DELETE FROM listings WHERE id = ${listing.id}`;
    await sql`DELETE FROM users WHERE id = ${owner.id}`;
  }
});

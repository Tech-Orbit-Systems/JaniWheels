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

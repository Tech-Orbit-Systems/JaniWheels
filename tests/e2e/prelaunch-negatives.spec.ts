import "dotenv/config";
import { randomUUID } from "node:crypto";
import { expect, test, type Page, type Request } from "@playwright/test";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !/(?:_test|_acceptance)$/.test(new URL(databaseUrl).pathname.slice(1))) {
  throw new Error("Negative acceptance requires an isolated test database");
}
const sql = postgres(databaseUrl, { max: 1 });
test.afterAll(async () => { await sql.end(); });

async function capture(page: Page, submit: () => Promise<unknown>) {
  let resolve!: (request: Request) => void;
  const pending = new Promise<Request>((done) => { resolve = done; });
  await page.route("**/*", async (route) => {
    if (route.request().method() === "POST" && route.request().headers()["next-action"]) {
      await route.abort();
      resolve(route.request());
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

test("direct registration payload rejects malformed email without creating an account", async ({ page }) => {
  const email = `prelaunch-${randomUUID()}@example.invalid`;
  await page.goto("/login?mode=register");
  await page.getByLabel("Full name").fill("Negative fixture");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill("AcceptanceOnly123!");
  const action = await capture(page, () => page.getByRole("button", { name: "Create account with email" }).click());
  expect(action.data.toString()).toContain(email);
  const response = await page.request.post(action.url, {
    data: Buffer.from(action.data.toString().replace(email, "invalid-email")),
    headers: action.headers,
    maxRedirects: 0,
  });
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain("Enter a valid email address.");
  const [row] = await sql`SELECT count(*)::int n FROM users WHERE email=${email}`;
  expect(row.n).toBe(0);
});

test("direct report payload rejects forged reason, ad ID and oversized comment without a report", async ({ page }) => {
  const tag = `prelaunch-${randomUUID()}`;
  const [owner] = await sql`INSERT INTO users(email) VALUES (${`${tag}@example.invalid`}) RETURNING id`;
  const [city] = await sql`SELECT id FROM cities ORDER BY id LIMIT 1`;
  const [listing] = await sql`INSERT INTO listings(vertical,seller_id,slug,title,price_pkr,city_id,status,published_at)
    VALUES ('part',${owner.id},${tag},${tag},2500,${city.id},'active',NOW()) RETURNING id`;
  try {
    await page.goto(`/auto-parts/${tag}-${listing.id}`);
    await page.getByRole("button", { name: "Report this ad" }).click();
    await page.locator('select[name="reason"]').selectOption("fraud");
    await page.locator('textarea[name="comment"]').fill("brief note");
    const action = await capture(page, () => page.getByRole("button", { name: "Send report" }).click());
    const body = action.data.toString();
    expect(body).toContain("fraud");
    expect(body).toContain("brief note");
    const forgedId = body.replace(/(name="[^"]*listingId"\r?\n\r?\n)\d+/, "$1-1");
    expect(forgedId).not.toBe(body);
    for (const invalid of [
      body.replace("fraud", "forged_reason"),
      forgedId,
      body.replace("brief note", "x".repeat(1001)),
    ]) {
      const response = await page.request.post(action.url, { data: Buffer.from(invalid), headers: action.headers, maxRedirects: 0 });
      expect(response.status()).toBe(200);
      expect(await response.text()).toContain("Choose a reason.");
      const [row] = await sql`SELECT count(*)::int n FROM listing_reports WHERE listing_id=${listing.id}`;
      expect(row.n).toBe(0);
    }
  } finally {
    await sql`DELETE FROM listings WHERE id=${listing.id}`;
    await sql`DELETE FROM users WHERE id=${owner.id}`;
  }
});

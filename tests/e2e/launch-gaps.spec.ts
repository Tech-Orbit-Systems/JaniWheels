import "dotenv/config";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import postgres from "postgres";

const url = process.env.DATABASE_URL!;
if (!/(?:_test|_acceptance)$/.test(new URL(url).pathname)) throw new Error("Isolated acceptance database required");
const sql = postgres(url, { max: 1 });
test.afterAll(async () => { await sql.end(); });

test("readiness and cron routing expose only intended public information", async ({ request }) => {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ status: "ready" });
  expect(health.headers()["cache-control"]).toBe("no-store");
  expect((await request.post("/api/cron/saved-search-alerts")).status()).toBe(401);
  const unknown = await request.post("/api/cron/constructor", { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
  expect(unknown.status()).toBe(404);
});

test("dealer totals, pagination and inactive inventory remain consistent", async ({ page }) => {
  const tag = `inventory-${randomUUID()}`;
  const [owner] = await sql`INSERT INTO users (email,type) VALUES (${`${tag}@example.invalid`},'dealer') RETURNING id`;
  const [city] = await sql`SELECT id FROM cities LIMIT 1`;
  const [dealer] = await sql`INSERT INTO dealers (user_id,business_name,slug,city_id,verified_at) VALUES (${owner.id},${tag},${tag},${city.id},NOW()) RETURNING id`;
  try {
    await sql`INSERT INTO listings (vertical,seller_id,dealer_id,slug,title,price_pkr,city_id,status,published_at)
      SELECT 'part',${owner.id},${dealer.id},${tag}||'-'||i,${tag}||' item '||i,2500,${city.id},'active',NOW() FROM generate_series(1,26) i`;
    const inactive = await sql`INSERT INTO listings (vertical,seller_id,dealer_id,slug,title,price_pkr,city_id,status,published_at)
      SELECT 'part',${owner.id},${dealer.id},${tag}||'-'||s,${tag}||' hidden '||s,2500,${city.id},s::listing_status,NOW()
      FROM unnest(ARRAY['sold','expired','removed','pending_review']) s RETURNING id,slug`;
    await page.goto("/dealers");
    await expect(page.getByRole("link", { name: new RegExp(tag) })).toContainText("26 active ads");
    await page.goto(`/dealers/${tag}`);
    await expect(page.getByRole("heading", { name: "26 active ads", exact: true })).toBeVisible();
    const cards = page.locator('main ul a[href^="/auto-parts/"]');
    const firstPage = await cards.evaluateAll(nodes => nodes.map(node => node.getAttribute("href")));
    await expect(cards).toHaveCount(25);
    await page.getByRole("navigation", { name: "Dealer inventory pages" }).getByRole("link", { name: "Next" }).click();
    await expect(cards).toHaveCount(1);
    expect(firstPage).not.toContain(await cards.first().getAttribute("href"));
    await expect(page.getByText("Page 2 of 2", { exact: true })).toBeVisible();
    await page.goto(`/dealers/${tag}?page=Infinity`);
    await expect(cards).toHaveCount(25);
    for (const row of inactive) expect((await page.request.get(`/auto-parts/${row.slug}-${row.id}`)).status()).toBe(404);
    await sql`UPDATE users SET is_banned=true WHERE id=${owner.id}`;
    expect((await page.request.get(`/dealers/${tag}`)).status()).toBe(404);
    await page.goto("/dealers");
    await expect(page.getByRole("link", { name: new RegExp(tag) })).toHaveCount(0);
  } finally {
    await sql`DELETE FROM listings WHERE seller_id=${owner.id}`;
    await sql`DELETE FROM dealers WHERE id=${dealer.id}`;
    await sql`DELETE FROM users WHERE id=${owner.id}`;
  }
});

test("tablet, enlarged text and reduced-motion homepage remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const route of ["/", "/used-cars", "/used-bikes", "/auto-parts", "/dealers", "/login"]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    const layout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      offenders: [...document.querySelectorAll("body *")].filter(node => node.getBoundingClientRect().right > innerWidth + 1)
        .slice(0, 12).map(node => ({ tag: node.tagName, class: node.className, text: node.textContent?.slice(0, 60) })),
    }));
    expect(layout.overflow, `${route}: ${JSON.stringify(layout.offenders)}`).toBeLessThanOrEqual(1);
  }
  await page.goto("/");
  const animations = await page.locator(".hero-vehicle, .sell-vehicle-image, .sell-vehicle-halo").evaluateAll(nodes => nodes.map(node => getComputedStyle(node).animationName));
  expect(animations.length).toBeGreaterThan(0);
  expect(animations.every(name => name === "none")).toBe(true);
});

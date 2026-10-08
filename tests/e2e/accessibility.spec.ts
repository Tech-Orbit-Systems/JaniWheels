import { expect, test, type Page } from "@playwright/test";
import axe from "axe-core";
import "dotenv/config";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL!;
if (!/(?:_test|_acceptance)$/.test(new URL(databaseUrl).pathname)) throw new Error("Isolated acceptance database required");
const sql = postgres(databaseUrl, { max: 1 });
test.afterAll(async () => { await sql.end(); });

const PUBLIC_ROUTES = [
  "/", "/used-cars", "/used-bikes", "/auto-parts", "/dealers",
  "/inspection", "/sell-my-car", "/login", "/contact", "/privacy",
  "/about", "/safety", "/terms", "/compare",
];

async function scanPage(page: Page) {
  return page.evaluate(async () => {
    const scanner = (window as unknown as {
      axe: { run: (root: Document) => Promise<{
        violations: { id: string; nodes: { target: string[] }[] }[];
      }> };
    }).axe;
    const result = await scanner.run(document);
    return result.violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.slice(0, 5).map((node) => node.target.join(" ")),
      count: nodes.length,
    }));
  });
}

test("public pages pass automated accessibility checks", async ({ context }) => {
  test.setTimeout(150_000);
  await context.addInitScript({ content: axe.source });
  for (const route of PUBLIC_ROUTES) {
    const page = await context.newPage();
    try {
      const response = await page.goto(route, { waitUntil: "load" });
      expect(response?.status(), route).toBe(200);
      expect(new URL(page.url()).pathname, route).toBe(route);
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.locator("h1").first()).toBeVisible();
      expect(await scanPage(page), route).toEqual([]);
    } finally {
      await page.close();
    }
  }
});

test("seller pages pass automated accessibility checks", async ({ page, context, isMobile }) => {
  test.setTimeout(150_000);
  await context.addInitScript({ content: axe.source });
  await page.goto("/login?next=/dashboard");
  await page.getByRole("textbox", { name: "Email or mobile number" })
    .fill(`acceptance-seller-${isMobile ? "mobile" : "desktop"}@example.invalid`);
  await page.getByLabel("Password").fill("AcceptanceOnly123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);

  for (const route of ["/dashboard", "/dashboard/profile", "/dashboard/saved", "/dashboard/saved-searches", "/dashboard/inspections", "/dashboard/sell-assistance", "/sell", "/sell/bike", "/sell/part", "/dealers/register"]) {
    const protectedPage = await context.newPage();
    try {
      const response = await protectedPage.goto(route, { waitUntil: "load" });
      expect(response?.status(), route).toBe(200);
      expect(new URL(protectedPage.url()).pathname, route).toBe(route);
      expect(await scanPage(protectedPage), route).toEqual([]);
    } finally {
      await protectedPage.close();
    }
  }
});

test("vehicle-detail pages pass automated accessibility checks", async ({ context }) => {
  test.setTimeout(180_000);
  await context.addInitScript({ content: axe.source });
  for (const route of ["/used-cars", "/used-bikes", "/auto-parts"]) {
    const page = await context.newPage();
    try {
      // Concurrent lifecycle tests remove their ads; scan a stable demo record instead.
      const vertical = route === "/used-cars" ? "car" : route === "/used-bikes" ? "bike" : "part";
      const [listing] = await sql`
        SELECT l.id, l.slug FROM listings l JOIN users u ON u.id = l.seller_id
        WHERE l.vertical = ${vertical} AND l.status = 'active'
          AND u.phone IN ('+923001234567', '+923219876543', '+923334455667', '+923455667788')
        ORDER BY l.id LIMIT 1
      `;
      expect(listing, route).toBeTruthy();
      const detailPath = `${route}/${listing.slug}-${listing.id}`;
      const response = await page.goto(detailPath, { waitUntil: "domcontentloaded" });
      expect(response?.status(), detailPath).toBe(200);
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.locator("h1").first()).toBeVisible();
      expect(await scanPage(page), detailPath).toEqual([]);
    } finally {
      await page.close();
    }
  }
});

test("dealer pages pass automated accessibility checks", async ({ page, context, isMobile }) => {
  test.setTimeout(120_000);
  await context.addInitScript({ content: axe.source });
  await page.goto("/login?next=/dashboard/dealer");
  await page.getByRole("textbox", { name: "Email or mobile number" })
    .fill(`acceptance-a11y-dealer-${isMobile ? "mobile" : "desktop"}@example.invalid`);
  await page.getByLabel("Password").fill("AcceptanceOnly123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard\/dealer(?:\?|$)/);

  for (const route of ["/dashboard/dealer", "/dashboard/dealer/settings"]) {
    const dealerPage = await context.newPage();
    try {
      const response = await dealerPage.goto(route, { waitUntil: "load" });
      expect(response?.status(), route).toBe(200);
      expect(new URL(dealerPage.url()).pathname, route).toBe(route);
      expect(await scanPage(dealerPage), route).toEqual([]);
    } finally {
      await dealerPage.close();
    }
  }
});

test("administrator pages pass automated accessibility checks", async ({ page, context }) => {
  test.setTimeout(150_000);
  await context.addInitScript({ content: axe.source });
  await page.goto("/login?next=/admin/listings");
  await page.getByRole("textbox", { name: "Email or mobile number" }).fill("acceptance-admin@example.invalid");
  await page.getByLabel("Password").fill("AcceptanceOnly123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/listings(?:\?|$)/);

  for (const route of ["/admin/listings", "/admin/users", "/admin/dealers", "/admin/inspections", "/admin/sell-assistance"]) {
    const adminPage = await context.newPage();
    try {
      const response = await adminPage.goto(route, { waitUntil: "load" });
      expect(response?.status(), route).toBe(200);
      expect(new URL(adminPage.url()).pathname, route).toBe(route);
      expect(await scanPage(adminPage), route).toEqual([]);
    } finally {
      await adminPage.close();
    }
  }
});

test("keyboard skip link reaches page content", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await skip.press("Enter");
  await expect(page).toHaveURL(/#main-content$/);
});

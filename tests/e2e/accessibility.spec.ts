import { expect, test, type Page } from "@playwright/test";
import axe from "axe-core";

const PUBLIC_ROUTES = [
  "/", "/used-cars", "/used-bikes", "/auto-parts", "/dealers",
  "/inspection", "/sell-my-car", "/login", "/contact", "/privacy",
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

  for (const route of ["/dashboard", "/dashboard/profile", "/dashboard/saved", "/sell", "/sell/bike", "/sell/part", "/dealers/register"]) {
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

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
      targets: nodes.map((node) => node.target.join(" ")),
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

  for (const route of ["/dashboard", "/dashboard/profile", "/dashboard/saved", "/sell", "/sell/bike", "/sell/part"]) {
    const protectedPage = await context.newPage();
    try {
      const response = await protectedPage.goto(route, { waitUntil: "load" });
      expect(response?.status(), route).toBe(200);
      expect(await scanPage(protectedPage), route).toEqual([]);
    } finally {
      await protectedPage.close();
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

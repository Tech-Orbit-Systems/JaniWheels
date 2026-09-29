import { expect, test } from "@playwright/test";

test("homepage search switches between all three marketplaces", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Cars" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("link", { name: /Sedan/i }).first()).toHaveAttribute("href", "/used-cars/bt_sedan");

  await page.getByRole("tab", { name: "Bikes" }).click();
  await expect(page.getByRole("tab", { name: "Bikes" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Search Vehicles" }).click();
  await expect(page).toHaveURL(/\/used-bikes/);

  await page.goto("/");
  await page.getByRole("tab", { name: "Auto Parts" }).click();
  await expect(page.getByRole("button", { name: "Search Parts" })).toBeVisible();
  await page.getByRole("button", { name: "Search Parts" }).click();
  await expect(page).toHaveURL(/\/auto-parts/);
});

test("public browse pages and unknown facet policy", async ({ page, request }) => {
  for (const path of ["/used-cars", "/used-bikes", "/auto-parts", "/used-cars/bt_sedan"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  const unknown = await request.get("/used-cars/not-a-real-facet");
  expect(unknown.status()).toBe(404);
});

test("seller and admin areas require sign-in", async ({ page }) => {
  for (const path of ["/sell", "/dashboard", "/dealers/register", "/admin/moderation"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  }
});

test("seller can sign in and reach listing and dealer tools", async ({ page }) => {
  await page.goto("/login?next=/dashboard");
  await page.getByRole("textbox", { name: "Email or mobile number" }).fill("acceptance-seller@example.invalid");
  await page.getByLabel("Password").fill("AcceptanceOnly123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
  await expect(page.getByRole("heading", { name: "My ads" })).toBeVisible();
  await page.goto("/sell");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto("/dealers/register");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto("/admin/moderation");
  await expect(page).toHaveURL(/\/$/);
});

test("admin can sign in and open moderation", async ({ page }) => {
  await page.goto("/login?next=/admin/moderation");
  await page.getByRole("textbox", { name: "Email or mobile number" }).fill("acceptance-admin@example.invalid");
  await page.getByLabel("Password").fill("AcceptanceOnly123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/moderation(?:\?|$)/);
  await expect(page.getByRole("heading", { name: "Moderation" })).toBeVisible();
});

test("mobile viewport does not overflow horizontally", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile-only acceptance");
  await page.goto("/");
  const widths = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
});

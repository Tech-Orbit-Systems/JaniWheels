import { expect, test } from "@playwright/test";
import sharp from "sharp";

test("iPhone WebKit navigation and search stay within the viewport", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.locator("header summary").click();
  await expect(page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Used Cars" })).toBeVisible();
  await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Used Cars" }).click();
  await expect(page).toHaveURL(/\/used-cars(?:\?|$)/);
  await page.goto("/");
  await page.getByRole("tab", { name: "Auto Parts" }).click();
  await page.getByRole("button", { name: "Search Parts" }).click();
  await expect(page).toHaveURL(/\/auto-parts(?:\?|$)/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("iPhone WebKit signs in and uploads a listing photo", async ({ page }) => {
  const localOrigin = new URL(process.env.ACCEPTANCE_BASE_URL ?? "http://127.0.0.1:3101");
  localOrigin.hostname = "localhost";
  await page.goto(new URL("/login?next=/sell", localOrigin).toString());
  await page.getByRole("textbox", { name: "Email or mobile number" }).fill("acceptance-seller-mobile@example.invalid");
  await page.getByLabel("Password").fill("AcceptanceOnly123!");
  const sessionResponse = page.waitForResponse((response) =>
    response.request().method() === "POST" && response.url().includes("/login?next=/sell") && response.status() === 303,
  );
  await page.getByRole("button", { name: "Sign in" }).click();
  const cookieHeader = await (await sessionResponse).headerValue("set-cookie");
  const sessionToken = /(?:^|\s)jw_session=([^;]+)/.exec(cookieHeader ?? "")?.[1];
  expect(sessionToken).toBeTruthy();
  // Local production builds use HTTP; WebKit drops Secure cookies until HTTPS is available.
  await page.context().addCookies([{ name: "jw_session", value: sessionToken!, url: localOrigin.origin, httpOnly: true, secure: false, sameSite: "Lax" }]);
  await expect(page).toHaveURL(/\/sell(?:\?|$)/);
  await page.reload();
  const image = await sharp({ create: { width: 24, height: 24, channels: 3, background: "#795533" } }).png().toBuffer();
  await page.locator('input[type="file"]').setInputFiles({ name: "iphone.png", mimeType: "image/png", buffer: image });
  await expect(page.getByText("1 photo added")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

import { expect, test } from "@playwright/test";
import "dotenv/config";
import postgres from "postgres";
import sharp from "sharp";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !/(?:_test|_acceptance)$/.test(new URL(databaseUrl).pathname.slice(1))) {
  throw new Error("Browser acceptance requires an isolated test database");
}
const sql = postgres(databaseUrl, { max: 1 });
test.afterAll(async () => { await sql.end(); });

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

test("invalid, banned and unverified credentials cannot create a session", async ({ page }) => {
  await page.goto("/login");
  const identifier = page.getByRole("textbox", { name: "Email or mobile number" });
  const password = page.getByLabel("Password");
  await identifier.fill("absent@example.invalid");
  await password.fill("AcceptanceOnly123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Incorrect email, mobile number or password.")).toBeVisible();

  await page.goto("/login");
  await identifier.fill("acceptance-banned@example.invalid");
  await password.fill("AcceptanceOnly123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Incorrect email, mobile number or password.")).toBeVisible();

  await page.goto("/login");
  await identifier.fill("acceptance-unverified@example.invalid");
  await password.fill("AcceptanceOnly123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/Verify your email before signing in/)).toBeVisible();
  const sessions = await sql`
    SELECT COUNT(*)::int AS count FROM sessions
    WHERE user_id IN (SELECT id FROM users WHERE email IN ('acceptance-banned@example.invalid', 'acceptance-unverified@example.invalid'))
  `;
  expect(sessions[0].count).toBe(0);
});

test("duplicate email registration is rejected without creating another user", async ({ page }) => {
  await page.goto("/login?mode=register");
  await page.getByLabel("Full name").fill("Duplicate Seller");
  await page.getByLabel("Email address").fill("acceptance-seller@example.invalid");
  await page.getByLabel("Password").fill("AcceptanceOnly123!");
  await page.getByRole("button", { name: "Create account with email" }).click();
  await expect(page.getByText("An account already exists with this email address.")).toBeVisible();
  const users = await sql`SELECT COUNT(*)::int AS count FROM users WHERE email = 'acceptance-seller@example.invalid'`;
  expect(users[0].count).toBe(1);
});

test("admin can sign in and open moderation", async ({ page }) => {
  await page.goto("/login?next=/admin/moderation");
  await page.getByRole("textbox", { name: "Email or mobile number" }).fill("acceptance-admin@example.invalid");
  await page.getByLabel("Password").fill("AcceptanceOnly123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/moderation(?:\?|$)/);
  await expect(page.getByRole("heading", { name: "Moderation" })).toBeVisible();
});

test("dealer can register and reach the new dashboard", async ({ page, isMobile }) => {
  const device = isMobile ? "mobile" : "desktop";
  const businessName = `Acceptance Motors ${device}`;
  await page.goto("/login?next=/dealers/register");
  await page.getByRole("textbox", { name: "Email or mobile number" }).fill(`acceptance-dealer-${device}@example.invalid`);
  await page.getByLabel("Password").fill("AcceptanceOnly123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dealers\/register(?:\?|$)/);
  await page.locator('input[name="businessName"]').fill(businessName);
  await page.locator('select[name="cityId"]').selectOption({ index: 1 });
  await page.getByRole("button", { name: "Create dealer account" }).click();
  await expect(page).toHaveURL(/\/dashboard\/dealer(?:\?|$)/);
  await expect(page.getByRole("heading", { name: businessName })).toBeVisible();
  await expect(page.getByText("Verification pending")).toBeVisible();
});

test("seller uploads a photo and publishes a car", async ({ page, isMobile }) => {
  const device = isMobile ? "mobile" : "desktop";
  await page.goto("/login?next=/sell");
  await page.getByRole("textbox", { name: "Email or mobile number" }).fill(`acceptance-seller-${device}@example.invalid`);
  await page.getByLabel("Password").fill("AcceptanceOnly123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/sell(?:\?|$)/);
  await expect.poll(async () => (await page.context().cookies()).some((cookie) => cookie.name === "jw_session")).toBe(true);

  const cookies = await page.context().cookies();
  const foreignUpload = await page.request.post("/api/upload", {
    headers: {
      origin: "https://foreign.example.invalid",
      cookie: cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; "),
    },
    multipart: { files: { name: "foreign.png", mimeType: "image/png", buffer: Buffer.from("not an image") } },
  });
  expect(foreignUpload.status()).toBe(403);

  const car = page.locator("section").filter({ has: page.getByRole("heading", { name: "Which car?" }) });
  const make = car.locator("select").nth(0);
  const model = car.locator("select").nth(1);
  const variant = car.locator('select[name="variantId"]');
  await make.selectOption({ index: 1 });
  await expect.poll(() => model.locator("option").count()).toBeGreaterThan(1);
  await model.selectOption({ index: 1 });
  await expect.poll(() => variant.locator("option").count()).toBeGreaterThan(1);
  await variant.selectOption({ index: 1 });
  await page.locator('select[name="year"]').selectOption("2022");
  await page.locator('input[name="mileageKm"]').fill("45000");
  await page.locator('select[name="cityId"]').selectOption({ index: 1 });
  await page.locator('input[name="pricePkr"]').fill("3500000");
  await page.getByLabel("Unregistered", { exact: true }).check();
  await expect(page.locator('select[name="registeredCityId"]')).toHaveCount(0);
  await expect(page.locator('select[name="lastTokenPaidYear"]')).toHaveCount(0);
  await page.getByLabel("Unregistered", { exact: true }).uncheck();
  await page.locator('select[name="registeredCityId"]').selectOption({ index: 1 });
  await page.locator('select[name="lastTokenPaidYear"]').selectOption("2025");
  await page.getByLabel("Auction sheet available").check();
  await page.locator('input[name="auctionGrade"]').fill("4.5");

  const photo = await sharp({ create: { width: 32, height: 32, channels: 3, background: "#9c2626" } }).png().toBuffer();
  await page.locator('input[type="file"]').setInputFiles({ name: "acceptance.png", mimeType: "image/png", buffer: photo });
  await expect(page.getByText("1 photo added")).toBeVisible();
  const imageKey = await page.locator('input[name="imageKeys"]').inputValue();
  const image = await page.request.get(`/uploads/${imageKey}`);
  expect(image.ok()).toBe(true);
  expect(image.headers()["content-type"]).toContain("image/webp");
  await page.getByRole("button", { name: "Post ad — free" }).click();
  await expect(page).toHaveURL(/\/used-cars\/.+\?posted=1/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const saved = await sql`
    SELECT cd.registered_city_id, cd.is_unregistered, cd.last_token_paid_year,
      cd.has_auction_sheet, cd.auction_grade
    FROM car_details cd
    JOIN listings l ON l.id = cd.listing_id
    JOIN users u ON u.id = l.seller_id
    WHERE u.email = ${`acceptance-seller-${device}@example.invalid`}
    ORDER BY l.id DESC LIMIT 1
  `;
  expect(saved[0]).toMatchObject({
    is_unregistered: false,
    last_token_paid_year: 2025,
    has_auction_sheet: true,
    auction_grade: "4.5",
  });
  expect(saved[0].registered_city_id).toBeGreaterThan(0);
});

test("seller publishes a bike with a photo", async ({ page, isMobile }) => {
  const device = isMobile ? "mobile" : "desktop";
  await page.goto("/login?next=/sell/bike");
  await page.getByRole("textbox", { name: "Email or mobile number" }).fill(`acceptance-seller-${device}@example.invalid`);
  await page.getByLabel("Password").fill("AcceptanceOnly123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  const bike = page.locator("section").filter({ has: page.getByRole("heading", { name: "Which bike?" }) });
  const make = bike.locator("select").nth(0);
  const model = bike.locator("select").nth(1);
  const variant = bike.locator('select[name="variantId"]');
  await make.selectOption({ index: 1 });
  await expect.poll(() => model.locator("option").count()).toBeGreaterThan(1);
  await model.selectOption({ index: 1 });
  await expect.poll(() => variant.locator("option").count()).toBeGreaterThan(1);
  await variant.selectOption({ index: 1 });
  await page.locator('select[name="year"]').selectOption("2022");
  await page.locator('input[name="mileageKm"]').fill("12000");
  await page.locator('select[name="cityId"]').selectOption({ index: 1 });
  await page.locator('input[name="pricePkr"]').fill("250000");
  const photo = await sharp({ create: { width: 32, height: 32, channels: 3, background: "#26269c" } }).png().toBuffer();
  await page.locator('input[type="file"]').setInputFiles({ name: "bike.png", mimeType: "image/png", buffer: photo });
  await expect(page.getByText("1 photo added")).toBeVisible();
  await page.getByRole("button", { name: "Post Bike Ad — Free" }).click();
  await expect(page).toHaveURL(/\/used-bikes\/.+\?posted=1/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("seller publishes an auto part with a photo", async ({ page, isMobile }) => {
  const device = isMobile ? "mobile" : "desktop";
  await page.goto("/login?next=/sell/part");
  await page.getByRole("textbox", { name: "Email or mobile number" }).fill(`acceptance-seller-${device}@example.invalid`);
  await page.getByLabel("Password").fill("AcceptanceOnly123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.locator('select[name="categoryId"]').selectOption({ index: 1 });
  await page.locator('input[name="brand"]').fill("Bosch");
  await page.locator('input[name="pricePkr"]').fill("2500");
  await page.locator('select[name="cityId"]').selectOption({ index: 1 });
  const photo = await sharp({ create: { width: 32, height: 32, channels: 3, background: "#269c26" } }).png().toBuffer();
  await page.locator('input[type="file"]').setInputFiles({ name: "part.png", mimeType: "image/png", buffer: photo });
  await expect(page.getByText("1 photo added")).toBeVisible();
  await page.getByRole("button", { name: "Post Auto Part Ad — Free" }).click();
  await expect(page).toHaveURL(/\/auto-parts\/.+\?posted=1/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("anonymous buyer reveals a seller number and records a lead", async ({ page, isMobile }) => {
  const rows = await sql`
    SELECT id, slug, lead_count FROM listings
    WHERE vertical = 'car'
      AND seller_id IN (SELECT id FROM users WHERE phone IN ('+923001234567', '+923219876543', '+923334455667', '+923455667788'))
    ORDER BY id LIMIT 1 OFFSET ${isMobile ? 2 : 3}
  `;
  expect(rows).toHaveLength(1);
  const listing = rows[0];
  await page.goto(`/used-cars/${listing.slug}-${listing.id}`);
  await page.getByRole("button", { name: /Show number/ }).click();
  await expect(page.locator('a[href^="tel:+92"]')).toBeVisible();
  await expect.poll(async () => {
    const [updated] = await sql`SELECT lead_count FROM listings WHERE id = ${listing.id}`;
    return updated.lead_count;
  }).toBeGreaterThan(listing.lead_count);
});

test("admin approves a queued car and writes an audit entry", async ({ page, isMobile }) => {
  const rows = await sql`
    SELECT id, title FROM listings
    WHERE vertical = 'car'
      AND seller_id IN (SELECT id FROM users WHERE phone IN ('+923001234567', '+923219876543', '+923334455667', '+923455667788'))
    ORDER BY id LIMIT 1 OFFSET ${isMobile ? 0 : 1}
  `;
  expect(rows).toHaveLength(1);
  const listing = rows[0];
  await page.goto("/login?next=/admin/moderation");
  await page.getByRole("textbox", { name: "Email or mobile number" }).fill("acceptance-admin@example.invalid");
  await page.getByLabel("Password").fill("AcceptanceOnly123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  const row = page.locator("li").filter({ has: page.locator(`a[href$="-${listing.id}"]`) });
  await expect(row.getByText(listing.title)).toBeVisible();
  await row.getByRole("button", { name: "Approve" }).click();
  await expect.poll(async () => {
    const [approved] = await sql`SELECT status FROM listings WHERE id = ${listing.id}`;
    return approved.status;
  }).toBe("active");
  const [audit] = await sql`SELECT count(*)::int AS count FROM moderation_log WHERE listing_id = ${listing.id} AND action = 'approve'`;
  expect(audit.count).toBeGreaterThan(0);
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

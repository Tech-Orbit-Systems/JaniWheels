import { expect, test } from "@playwright/test";
import "dotenv/config";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import postgres from "postgres";
import sharp from "sharp";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !/(?:_test|_acceptance)$/.test(new URL(databaseUrl).pathname.slice(1))) {
  throw new Error("Browser acceptance requires an isolated test database");
}
const sql = postgres(databaseUrl, { max: 1 });
test.afterAll(async () => { await sql.end(); });

function capturedEmailPath(kind: "verification" | "reset", email: string): string {
  const directory = process.env.ACCEPTANCE_EMAIL_DIR;
  if (!directory) throw new Error("Acceptance browser tests require a local email capture directory");
  const key = createHash("sha256").update(`${kind}:${email.toLowerCase()}`).digest("hex");
  return join(directory, `${kind}-${key}.url`);
}

async function capturedEmailLink(kind: "verification" | "reset", email: string): Promise<string> {
  const path = capturedEmailPath(kind, email);
  await expect.poll(async () => {
    try { return (await readFile(path, "utf8")).trim(); }
    catch { return ""; }
  }).toMatch(/^https?:\/\//);
  return (await readFile(path, "utf8")).trim();
}

function localAcceptancePath(link: string): string {
  const url = new URL(link);
  return `${url.pathname}${url.search}`;
}

function rateKey(scope: string, subject: string, windowMs: number, period = Math.floor(Date.now() / windowMs)): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Acceptance rate-limit tests require SESSION_SECRET");
  return createHmac("sha256", secret).update(`${scope}\0${subject}\0${period}`).digest("hex");
}

async function fillRateBucket(scope: string, subject: string, hits: number, windowMs: number): Promise<void> {
  const key = rateKey(scope, subject, windowMs);
  await sql`INSERT INTO rate_limit_buckets (key, hits, expires_at)
    VALUES (${key}, ${hits}, ${new Date(Date.now() + windowMs)})
    ON CONFLICT (key) DO UPDATE SET hits = EXCLUDED.hits`;
}

test("account-settings limits reject profile, password and photo writes", async ({ page, isMobile }) => {
  const email = `acceptance-seller-${isMobile ? "mobile" : "desktop"}@example.invalid`;
  const [before] = await sql`SELECT id, name, password_hash, avatar_url FROM users WHERE email = ${email}`;
  expect(before?.id).toBeGreaterThan(0);
  const limits = [
    ["account:profile", 30, 60 * 60_000],
    ["account:password", 10, 60 * 60_000],
    ["account:avatar", 10, 24 * 60 * 60_000],
  ] as const;
  for (const [scope, hits, windowMs] of limits) {
    await fillRateBucket(scope, `user:${before.id}`, hits, windowMs);
  }
  try {
    await page.goto("/login?next=/dashboard/profile");
    await page.getByRole("textbox", { name: "Email or mobile number" }).fill(email);
    await page.getByLabel("Password").fill("AcceptanceOnly123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard\/profile(?:\?|$)/);

    await page.getByLabel("Full name").fill("Rejected profile update");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Too many profile changes. Try again later.")).toBeVisible();

    await page.locator('input[name="currentPassword"]').last().fill("AcceptanceOnly123!");
    await page.getByLabel("New password", { exact: true }).fill("RejectedPassword123!");
    await page.getByLabel("Confirm new password").fill("RejectedPassword123!");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Too many password attempts. Try again later.")).toBeVisible();

    const image = await sharp({ create: { width: 24, height: 24, channels: 3, background: "#557799" } }).png().toBuffer();
    await page.getByLabel("Choose profile photo").setInputFiles({ name: "profile.png", mimeType: "image/png", buffer: image });
    await page.getByRole("button", { name: "Upload photo" }).click();
    await expect(page.getByText("Too many photo uploads. Try again later.")).toBeVisible();

    const [after] = await sql`SELECT name, password_hash, avatar_url FROM users WHERE id = ${before.id}`;
    expect(after).toMatchObject({ name: before.name, password_hash: before.password_hash, avatar_url: before.avatar_url });
  } finally {
    for (const [scope, , windowMs] of limits) {
      await sql`DELETE FROM rate_limit_buckets WHERE key = ${rateKey(scope, `user:${before.id}`, windowMs)}`;
    }
  }
});

test("seller can upload, replace and remove their profile photo", async ({ page, isMobile }) => {
  const email = `acceptance-seller-${isMobile ? "mobile" : "desktop"}@example.invalid`;
  const [account] = await sql`SELECT id, avatar_url FROM users WHERE email = ${email}`;
  expect(account?.id).toBeGreaterThan(0);
  expect(account.avatar_url).toBeNull();

  await page.goto("/login?next=/dashboard/profile");
  await page.getByRole("textbox", { name: "Email or mobile number" }).fill(email);
  await page.getByLabel("Password").fill("AcceptanceOnly123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard\/profile(?:\?|$)/);

  const uploadedKeys: string[] = [];
  try {
    for (const color of ["#557799", "#996644"]) {
      const image = await sharp({ create: { width: 24, height: 24, channels: 3, background: color } }).png().toBuffer();
      await page.getByLabel("Choose profile photo").setInputFiles({ name: "profile.png", mimeType: "image/png", buffer: image });
      await page.getByRole("button", { name: "Upload photo" }).click();
      await expect(page.getByText("Profile photo updated.")).toBeVisible();
      const [updated] = await sql`SELECT avatar_url FROM users WHERE id = ${account.id}`;
      expect(updated?.avatar_url).toBeTruthy();
      uploadedKeys.push(updated.avatar_url);
      await expect(page.getByRole("img", { name: /profile$/ })).toBeVisible();
    }
    expect(uploadedKeys[1]).not.toBe(uploadedKeys[0]);
    await page.getByRole("button", { name: "Remove photo" }).click();
    await expect.poll(async () => {
      const [updated] = await sql`SELECT avatar_url FROM users WHERE id = ${account.id}`;
      return updated?.avatar_url;
    }).toBeNull();
  } finally {
    await sql`UPDATE users SET avatar_url = NULL WHERE id = ${account.id}`;
  }
});

test("dealer setting limits reject profile and logo writes", async ({ page, isMobile }) => {
  const email = `acceptance-a11y-dealer-${isMobile ? "mobile" : "desktop"}@example.invalid`;
  const [before] = await sql`
    SELECT d.id, d.business_name, d.logo_url, u.id AS user_id
    FROM dealers d JOIN users u ON u.id = d.user_id WHERE u.email = ${email}
  `;
  expect(before?.id).toBeGreaterThan(0);
  const limits = [
    ["account:dealer-profile", 30, 60 * 60_000],
    ["account:dealer-logo", 10, 24 * 60 * 60_000],
  ] as const;
  for (const [scope, hits, windowMs] of limits) {
    await fillRateBucket(scope, `user:${before.user_id}`, hits, windowMs);
  }
  try {
    await page.goto("/login?next=/dashboard/dealer/settings");
    await page.getByRole("textbox", { name: "Email or mobile number" }).fill(email);
    await page.getByLabel("Password").fill("AcceptanceOnly123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard\/dealer\/settings(?:\?|$)/);

    await page.getByLabel("Business name").fill("Rejected dealer profile");
    await page.getByRole("button", { name: "Save dealer profile" }).click();
    await expect(page.getByText("Too many dealer profile changes. Try again later.")).toBeVisible();

    const image = await sharp({ create: { width: 24, height: 24, channels: 3, background: "#557799" } }).png().toBuffer();
    await page.getByLabel("Choose dealer logo").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: image });
    await page.getByRole("button", { name: "Upload logo" }).click();
    await expect(page.getByText("Too many logo uploads. Try again later.")).toBeVisible();

    const [after] = await sql`SELECT business_name, logo_url FROM dealers WHERE id = ${before.id}`;
    expect(after).toMatchObject({ business_name: before.business_name, logo_url: before.logo_url });
  } finally {
    for (const [scope, , windowMs] of limits) {
      await sql`DELETE FROM rate_limit_buckets WHERE key = ${rateKey(scope, `user:${before.user_id}`, windowMs)}`;
    }
  }
});

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

test("active parts detail exposes classified Product markup", async ({ page }) => {
  const [part] = await sql`
    SELECT l.id, l.slug, l.title, l.price_pkr, p.condition
    FROM listings l JOIN part_details p ON p.listing_id = l.id
    WHERE l.vertical = 'part' AND l.status = 'active'
    ORDER BY l.id LIMIT 1
  `;
  expect(part?.id).toBeGreaterThan(0);
  await page.goto(`/auto-parts/${part.slug}-${part.id}`);
  const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
  const product = schemas.map((json) => JSON.parse(json)).find((schema) => schema["@type"] === "Product");
  expect(product).toMatchObject({
    "@id": page.url(),
    name: part.title,
    offers: { "@type": "Offer", price: part.price_pkr, priceCurrency: "PKR" },
  });
  expect(product.offers.itemCondition).toBe(`https://schema.org/${{ new: "NewCondition", used: "UsedCondition", refurbished: "RefurbishedCondition" }[part.condition as "new" | "used" | "refurbished"]}`);
  expect(product.offers).not.toHaveProperty("shippingDetails");
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

test("repeated sign-in failures show a retry limit", async ({ page, isMobile }) => {
  const email = `rate-limit-${isMobile ? "mobile" : "desktop"}-${randomBytes(4).toString("hex")}@example.invalid`;
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email or mobile number" }).fill(email);
  await page.getByLabel("Password").fill("AcceptanceOnly123!");
  const submit = page.getByRole("button", { name: "Sign in" });
  await submit.click();
  await expect(page.getByText("Incorrect email, mobile number or password.")).toBeVisible();
  const period = Math.floor(Date.now() / (15 * 60_000));
  const keys = [period, period - 1].map((window) => rateKey("sign-in", `identity:${email}`, 15 * 60_000, window));
  await expect.poll(async () => {
    const [bucket] = await sql`SELECT hits FROM rate_limit_buckets WHERE key IN ${sql(keys)}`;
    return bucket?.hits ?? 0;
  }).toBe(1);
  await sql`UPDATE rate_limit_buckets SET hits = 10 WHERE key IN ${sql(keys)}`;
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email or mobile number" }).fill(email);
  await page.getByLabel("Password").fill("AcceptanceOnly123!");
  await submit.click();
  await expect.poll(async () => {
    const [bucket] = await sql`SELECT hits FROM rate_limit_buckets WHERE key IN ${sql(keys)}`;
    return bucket?.hits ?? 0;
  }).toBe(11);
  await expect(page.getByText("Too many attempts. Please try again in 15 minutes.")).toBeVisible();
  const [session] = await sql`SELECT count(*)::int AS count FROM sessions WHERE user_id IN
    (SELECT id FROM users WHERE email = ${email})`;
  expect(session.count).toBe(0);
});

test("duplicate and invalid registrations do not create users", async ({ page, isMobile }) => {
  await page.goto("/login?mode=register");
  await page.getByLabel("Full name").fill("Duplicate Seller");
  await page.getByLabel("Email address").fill("acceptance-seller@example.invalid");
  await page.getByLabel("Password").fill("AcceptanceOnly123!");
  await page.getByRole("button", { name: "Create account with email" }).click();
  await expect(page.getByText("An account already exists with this email address.")).toBeVisible();
  const users = await sql`SELECT COUNT(*)::int AS count FROM users WHERE email = 'acceptance-seller@example.invalid'`;
  expect(users[0].count).toBe(1);

  const invalidEmail = `acceptance-invalid-${isMobile ? "mobile" : "desktop"}@example.invalid`;
  await page.goto("/login?mode=register");
  await page.getByLabel("Full name").fill("A");
  await page.getByLabel("Email address").fill(invalidEmail);
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Create account with email" }).click();
  await expect(page.getByText("Enter your full name.")).toBeVisible();
  await expect(page.getByText("Use at least 10 characters.")).toBeVisible();
  const [invalid] = await sql`SELECT count(*)::int AS count FROM users WHERE email = ${invalidEmail}`;
  expect(invalid.count).toBe(0);
});

test("new email account verifies once before it can sign in", async ({ page, isMobile }) => {
  const device = isMobile ? "mobile" : "desktop";
  const email = `acceptance-new-${device}@example.invalid`;
  const password = "RegistrationOnly123!";
  await rm(capturedEmailPath("verification", email), { force: true });
  await page.goto("/login?mode=register&next=/dashboard");
  await page.getByLabel("Full name").fill(`New buyer ${device}`);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account with email" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();
  const [created] = await sql`SELECT id, email_verified_at, phone FROM users WHERE email = ${email}`;
  expect(created).toMatchObject({ email_verified_at: null, phone: null });
  const [before] = await sql`SELECT count(*)::int AS count FROM sessions WHERE user_id = ${created.id}`;
  expect(before.count).toBe(0);
  const link = await capturedEmailLink("verification", email);
  expect(new URL(link).pathname).toBe("/verify-email");
  const [token] = await sql`SELECT token_hash, used_at FROM email_verification_tokens WHERE user_id = ${created.id} ORDER BY id DESC LIMIT 1`;
  expect(token.token_hash).toMatch(/^[a-f0-9]{64}$/);
  expect(token.used_at).toBeNull();

  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email or mobile number" }).fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/Verify your email before signing in/)).toBeVisible();
  await page.goto(localAcceptancePath(link));
  await page.getByRole("button", { name: "Verify email and continue" }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
  const [verified] = await sql`SELECT email_verified_at FROM users WHERE id = ${created.id}`;
  expect(verified.email_verified_at).not.toBeNull();
  const [used] = await sql`SELECT used_at FROM email_verification_tokens WHERE user_id = ${created.id} ORDER BY id DESC LIMIT 1`;
  expect(used.used_at).not.toBeNull();

  await page.context().clearCookies();
  await page.goto(localAcceptancePath(link));
  await page.getByRole("button", { name: "Verify email and continue" }).click();
  await expect(page.getByText("This verification link is invalid or has expired.")).toBeVisible();
  await sql`UPDATE email_verification_tokens SET used_at = NULL, expires_at = NOW() - INTERVAL '1 minute' WHERE token_hash = ${token.token_hash}`;
  await page.goto(localAcceptancePath(link));
  await page.getByRole("button", { name: "Verify email and continue" }).click();
  await expect(page.getByText("This verification link is invalid or has expired.")).toBeVisible();
});

test("password reset link is single use and revokes existing sessions", async ({ page, isMobile }) => {
  const device = isMobile ? "mobile" : "desktop";
  const email = `acceptance-reset-${device}@example.invalid`;
  const oldPassword = "AcceptanceOnly123!";
  const newPassword = "ResetAcceptanceOnly123!";
  await rm(capturedEmailPath("reset", email), { force: true });
  const [account] = await sql`SELECT id FROM users WHERE email = ${email}`;
  await page.goto("/login?next=/dashboard");
  await page.getByRole("textbox", { name: "Email or mobile number" }).fill(email);
  await page.getByLabel("Password").fill(oldPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
  await page.goto("/forgot-password");
  await page.getByLabel("Account email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();
  const link = await capturedEmailLink("reset", email);
  expect(new URL(link).pathname).toBe("/reset-password");
  const [token] = await sql`SELECT token_hash, used_at FROM password_reset_tokens WHERE user_id = ${account.id} ORDER BY id DESC LIMIT 1`;
  expect(token.token_hash).toMatch(/^[a-f0-9]{64}$/);
  expect(token.used_at).toBeNull();
  await expect.poll(async () => {
    const [before] = await sql`SELECT count(*)::int AS count FROM sessions WHERE user_id = ${account.id}`;
    return before.count;
  }).toBeGreaterThan(0);

  await page.goto(localAcceptancePath(link));
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm new password").fill(newPassword);
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page).toHaveURL(/\/login\?reset=success$/);
  const [revoked] = await sql`SELECT count(*)::int AS count FROM sessions WHERE user_id = ${account.id}`;
  expect(revoked.count).toBe(0);
  const [used] = await sql`SELECT used_at FROM password_reset_tokens WHERE user_id = ${account.id} ORDER BY id DESC LIMIT 1`;
  expect(used.used_at).not.toBeNull();

  await page.goto(localAcceptancePath(link));
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm new password").fill(newPassword);
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page.getByText("This reset link is invalid or has expired.")).toBeVisible();
  await sql`UPDATE password_reset_tokens SET used_at = NULL, expires_at = NOW() - INTERVAL '1 minute' WHERE token_hash = ${token.token_hash}`;
  await page.goto(localAcceptancePath(link));
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm new password").fill(newPassword);
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page.getByText("This reset link is invalid or has expired.")).toBeVisible();
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email or mobile number" }).fill(email);
  await page.getByLabel("Password").fill(oldPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Incorrect email, mobile number or password.")).toBeVisible();
  await page.getByRole("textbox", { name: "Email or mobile number" }).fill(email);
  await page.getByLabel("Password").fill(newPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
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

test("admin verification changes the public dealer badge and writes audit history", async ({ page, isMobile }) => {
  const device = isMobile ? "mobile" : "desktop";
  const businessName = `Acceptance Motors ${device}`;
  const [dealer] = await sql`
    SELECT d.id, d.slug, d.user_id FROM dealers d JOIN users u ON u.id = d.user_id
    WHERE u.email = ${`acceptance-dealer-${device}@example.invalid`}
  `;
  expect(dealer?.id).toBeGreaterThan(0);
  const [beforeVerify] = await sql`
    SELECT COUNT(*)::int AS count FROM moderation_log
    WHERE user_id = ${dealer.user_id} AND action = 'dealer_verify'
  `;
  await page.goto("/login?next=/admin/dealers");
  await page.getByRole("textbox", { name: "Email or mobile number" }).fill("acceptance-admin@example.invalid");
  await page.getByLabel("Password").fill("AcceptanceOnly123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/dealers(?:\?|$)/);
  const row = page.locator("li").filter({ has: page.getByRole("link", { name: businessName }) });
  await row.getByRole("button", { name: "Verify dealer" }).click();
  await expect.poll(async () => {
    const [updated] = await sql`SELECT verified_at FROM dealers WHERE id = ${dealer.id}`;
    return Boolean(updated.verified_at);
  }).toBe(true);
  const [verifiedAudit] = await sql`
    SELECT COUNT(*)::int AS count FROM moderation_log
    WHERE user_id = ${dealer.user_id} AND action = 'dealer_verify'
  `;
  expect(verifiedAudit.count).toBeGreaterThan(beforeVerify.count);
  await page.goto(`/dealers/${dealer.slug}`);
  await expect(page.getByText("Verified dealer", { exact: true })).toBeVisible();

  await page.goto("/admin/dealers");
  const verifiedRow = page.locator("li").filter({ has: page.getByRole("link", { name: businessName }) });
  const [beforeRevoke] = await sql`
    SELECT COUNT(*)::int AS count FROM moderation_log
    WHERE user_id = ${dealer.user_id} AND action = 'dealer_revoke'
  `;
  await verifiedRow.getByPlaceholder("Revocation reason (required)").fill("Acceptance review reset");
  await verifiedRow.getByRole("button", { name: "Revoke verification" }).click();
  await expect.poll(async () => {
    const [updated] = await sql`SELECT verified_at FROM dealers WHERE id = ${dealer.id}`;
    return updated.verified_at;
  }).toBeNull();
  const [revokedAudit] = await sql`
    SELECT COUNT(*)::int AS count FROM moderation_log
    WHERE user_id = ${dealer.user_id} AND action = 'dealer_revoke'
  `;
  expect(revokedAudit.count).toBeGreaterThan(beforeRevoke.count);
  await page.goto(`/dealers/${dealer.slug}`);
  await expect(page.getByText("Verified dealer", { exact: true })).toHaveCount(0);
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

  const email = `acceptance-seller-${device}@example.invalid`;
  const [seller] = await sql`SELECT id FROM users WHERE email = ${email}`;
  const limitKey = rateKey("listing-publication", `identity:user:${seller.id}`, 24 * 60 * 60_000);
  const [beforeLimit] = await sql`SELECT count(*)::int AS count FROM listings WHERE seller_id = ${seller.id}`;
  await fillRateBucket("listing-publication", `identity:user:${seller.id}`, 20, 24 * 60 * 60_000);
  try {
    await page.getByRole("button", { name: "Post ad — free" }).click();
    await expect(page.getByText("Too many ads posted today. Please try again tomorrow.")).toBeVisible();
    const [afterLimit] = await sql`SELECT count(*)::int AS count FROM listings WHERE seller_id = ${seller.id}`;
    expect(afterLimit.count).toBe(beforeLimit.count);
  } finally {
    await sql`DELETE FROM rate_limit_buckets WHERE key = ${limitKey}`;
  }
  // The form clears field selections after a server-action error; refill them to verify recovery.
  await make.selectOption({ index: 1 });
  await expect.poll(() => model.locator("option").count()).toBeGreaterThan(1);
  await model.selectOption({ index: 1 });
  await expect.poll(() => variant.locator("option").count()).toBeGreaterThan(1);
  await variant.selectOption({ index: 1 });
  await page.locator('select[name="year"]').selectOption("2022");
  await page.locator('input[name="mileageKm"]').fill("45000");
  await page.locator('select[name="cityId"]').selectOption({ index: 1 });
  await page.locator('input[name="pricePkr"]').fill("3500000");
  await page.locator('select[name="registeredCityId"]').selectOption({ index: 1 });
  await page.locator('select[name="lastTokenPaidYear"]').selectOption("2025");
  await page.getByLabel("Auction sheet available").check();
  await page.locator('input[name="auctionGrade"]').fill("4.5");
  await expect(page.getByText("1 photo added")).toBeVisible();
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

test("upload request limit rejects excess requests before reading files", async ({ page, isMobile }) => {
  const device = isMobile ? "mobile" : "desktop";
  const email = `acceptance-seller-${device}@example.invalid`;
  const [seller] = await sql`SELECT id FROM users WHERE email = ${email}`;
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email or mobile number" }).fill(email);
  await page.getByLabel("Password").fill("AcceptanceOnly123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
  const key = rateKey("image-upload", `identity:user:${seller.id}`, 60 * 60_000);
  await fillRateBucket("image-upload", `identity:user:${seller.id}`, 30, 60 * 60_000);
  try {
    const response = await page.evaluate(async () => {
      const response = await fetch("/api/upload", { method: "POST" });
      return { status: response.status, body: await response.json() };
    });
    expect(response.status).toBe(429);
    expect(response.body.error).toMatch(/Hourly upload request limit/);
  } finally {
    await sql`DELETE FROM rate_limit_buckets WHERE key = ${key}`;
  }
});

test("expired upload cleanup removes orphan files and retains claimed or failed rows", async ({ page, isMobile }) => {
  const device = isMobile ? "mobile" : "desktop";
  const directory = process.env.UPLOAD_DIR;
  const secret = process.env.CRON_SECRET;
  if (!directory || !secret) throw new Error("Acceptance upload directory and cron secret are required");
  const [owner] = await sql`SELECT id FROM users WHERE email = ${`acceptance-seller-${device}@example.invalid`}`;
  const [claimed] = await sql`
    SELECT p.storage_key FROM pending_uploads p JOIN listings l ON l.id = p.listing_id
    WHERE p.user_id = ${owner.id} AND l.vertical = 'car' AND p.claimed_at IS NOT NULL
    ORDER BY p.created_at DESC LIMIT 1
  `;
  expect(claimed?.storage_key).toBeTruthy();
  await sql`UPDATE pending_uploads SET created_at = NOW() - INTERVAL '25 hours' WHERE storage_key = ${claimed.storage_key}`;

  const key = `202610/${randomBytes(16).toString("hex")}.webp`;
  const file = join(directory, key);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, "orphan image");
  await sql`INSERT INTO pending_uploads (storage_key, user_id, bytes, created_at)
    VALUES (${key}, ${owner.id}, 12, NOW() - INTERVAL '25 hours')`;
  const invalidKey = `invalid-cleanup-${device}`;
  await sql`INSERT INTO pending_uploads (storage_key, user_id, bytes, created_at)
    VALUES (${invalidKey}, ${owner.id}, 12, NOW() - INTERVAL '25 hours')`;

  expect((await page.request.post("/api/cron/purge-expired")).status()).toBe(401);
  const [before] = await sql`SELECT count(*)::int AS count FROM pending_uploads WHERE storage_key = ${key}`;
  expect(before.count).toBe(1);
  const response = await page.request.post("/api/cron/purge-expired", {
    headers: { authorization: `Bearer ${secret}` },
  });
  expect(response.status()).toBe(200);
  await expect.poll(async () => {
    const [row] = await sql`SELECT count(*)::int AS count FROM pending_uploads WHERE storage_key = ${key}`;
    return row.count;
  }).toBe(0);
  await expect(readFile(file)).rejects.toMatchObject({ code: "ENOENT" });
  const [retained] = await sql`SELECT count(*)::int AS count FROM pending_uploads WHERE storage_key IN (${claimed.storage_key}, ${invalidKey})`;
  expect(retained.count).toBe(2);
  expect((await page.request.get(`/uploads/${claimed.storage_key}`)).status()).toBe(200);
  await sql`DELETE FROM pending_uploads WHERE storage_key = ${invalidKey}`;
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

test("another seller cannot open a private listing edit page", async ({ page, isMobile }) => {
  const device = isMobile ? "mobile" : "desktop";
  const [car] = await sql`
    SELECT l.id FROM listings l JOIN users u ON u.id = l.seller_id
    WHERE u.email = ${`acceptance-seller-${device}@example.invalid`} AND l.vertical = 'car'
    ORDER BY l.id DESC LIMIT 1
  `;
  expect(car?.id).toBeGreaterThan(0);
  await page.goto("/login?next=/dashboard");
  await page.getByRole("textbox", { name: "Email or mobile number" }).fill("acceptance-seller@example.invalid");
  await page.getByLabel("Password").fill("AcceptanceOnly123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
  await expect.poll(async () => (await page.context().cookies()).some((cookie) => cookie.name === "jw_session")).toBe(true);
  await page.goto(`/dashboard/listings/${car.id}/edit`);
  await expect(page.getByText("This page could not be found.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save advertisement changes" })).toHaveCount(0);
});

test("owner edits a car and deletes a bike with its photos", async ({ page, isMobile }) => {
  const device = isMobile ? "mobile" : "desktop";
  const email = `acceptance-seller-${device}@example.invalid`;
  const own = await sql`
    SELECT l.id, l.vertical, l.slug FROM listings l JOIN users u ON u.id = l.seller_id
    WHERE u.email = ${email} AND l.vertical IN ('car', 'bike')
    ORDER BY l.id DESC
  `;
  const car = own.find((row) => row.vertical === "car");
  const bike = own.find((row) => row.vertical === "bike");
  expect(car?.id).toBeGreaterThan(0);
  expect(bike?.id).toBeGreaterThan(0);
  const [photo] = await sql`SELECT storage_key FROM listing_images WHERE listing_id = ${bike!.id} ORDER BY position LIMIT 1`;
  expect(photo?.storage_key).toBeTruthy();

  await page.goto(`/login?next=/dashboard/listings/${car!.id}/edit`);
  await page.getByRole("textbox", { name: "Email or mobile number" }).fill(email);
  await page.getByLabel("Password").fill("AcceptanceOnly123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/listings/${car!.id}/edit`));
  await page.locator('input[name="pricePkr"]').fill("3650000");
  await page.getByRole("button", { name: "Save advertisement changes" }).click();
  await expect(page).toHaveURL(/\/dashboard\?updated=1/);
  const [edited] = await sql`SELECT price_pkr, status FROM listings WHERE id = ${car!.id}`;
  expect(edited).toMatchObject({ price_pkr: 3650000, status: "active" });

  const bikeRow = page.locator("li").filter({ has: page.locator(`a[href="/dashboard/listings/${bike!.id}/edit"]`) });
  await bikeRow.getByRole("button", { name: "Delete ad" }).click();
  await bikeRow.getByRole("button", { name: "Yes, delete" }).click();
  await expect.poll(async () => {
    const [row] = await sql`SELECT status, seller_deleted_at FROM listings WHERE id = ${bike!.id}`;
    return row?.status === "removed" && Boolean(row.seller_deleted_at);
  }).toBe(true);
  const images = await sql`SELECT id FROM listing_images WHERE listing_id = ${bike!.id}`;
  expect(images).toHaveLength(0);
  expect((await page.request.get(`/used-bikes/${bike!.slug}-${bike!.id}`)).status()).toBe(404);
  expect((await page.request.get(`/uploads/${photo.storage_key}`)).status()).toBe(404);
});

test("car detail links an inspection across sign-in and rejects a forged listing", async ({ page, isMobile }) => {
  const device = isMobile ? "mobile" : "desktop";
  const [car] = await sql`
    SELECT l.id, l.slug, l.title FROM listings l JOIN users u ON u.id = l.seller_id
    WHERE u.email = ${`acceptance-seller-${device}@example.invalid`} AND l.vertical = 'car' AND l.status = 'active'
    ORDER BY l.id DESC LIMIT 1
  `;
  expect(car?.id).toBeGreaterThan(0);
  await page.goto(`/used-cars/${car.slug}-${car.id}`);
  await page.getByRole("link", { name: "Request an inspection" }).click();
  await expect(page).toHaveURL(new RegExp(`/inspection\\?listingId=${car.id}$`));
  await expect(page.getByText(`For: ${car.title}`)).toBeVisible();
  await page.locator('select[name="cityId"]').selectOption({ index: 1 });
  await page.locator('input[name="address"]').fill(`Linked inspection ${device}`);
  await page.locator('input[name="contactPhone"]').fill("0300 9998877");
  await page.getByRole("button", { name: "Request inspection" }).click();
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByRole("textbox", { name: "Email or mobile number" }).fill("acceptance-seller@example.invalid");
  await page.getByLabel("Password").fill("AcceptanceOnly123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`/inspection\\?listingId=${car.id}$`));

  await page.locator('select[name="cityId"]').selectOption({ index: 1 });
  await page.locator('input[name="address"]').fill(`Forged inspection ${device}`);
  await page.locator('input[name="contactPhone"]').fill("0300 9998877");
  await page.locator('input[name="listingId"]').evaluate((input: HTMLInputElement) => { input.value = "999999999"; });
  await page.getByRole("button", { name: "Request inspection" }).click();
  await expect(page.getByText("This car listing is no longer available for inspection.")).toBeVisible();
  const [forged] = await sql`SELECT count(*)::int AS count FROM inspections WHERE address = ${`Forged inspection ${device}`}`;
  expect(forged.count).toBe(0);

  await page.locator('input[name="listingId"]').evaluate((input: HTMLInputElement, id: number) => { input.value = String(id); }, car.id);
  await page.locator('select[name="cityId"]').selectOption({ index: 1 });
  await page.locator('input[name="address"]').fill(`Linked inspection ${device}`);
  await page.locator('input[name="contactPhone"]').fill("0300 9998877");
  await page.getByRole("button", { name: "Request inspection" }).click();
  await expect(page.getByText("Inspection requested")).toBeVisible();
  const [linked] = await sql`
    SELECT i.id, i.listing_id, i.requested_by_user_id FROM inspections i JOIN users u ON u.id = i.requested_by_user_id
    WHERE u.email = 'acceptance-seller@example.invalid' AND i.address = ${`Linked inspection ${device}`}
    ORDER BY i.id DESC LIMIT 1
  `;
  expect(linked.listing_id).toBe(car.id);
  const [event] = await sql`SELECT to_status FROM inspection_events WHERE inspection_id = ${linked.id}`;
  expect(event.to_status).toBe("requested");
  expect((await page.request.get("/inspection?listingId=999999999")).status()).toBe(404);
});

test("signed-in report stays tied to the account across sessions", async ({ page, isMobile }) => {
  const device = isMobile ? "mobile" : "desktop";
  const [car] = await sql`
    SELECT l.id, l.slug FROM listings l JOIN users u ON u.id = l.seller_id
    WHERE u.email = ${`acceptance-seller-${device}@example.invalid`} AND l.vertical = 'car' AND l.status = 'active'
    ORDER BY l.id DESC LIMIT 1
  `;
  const path = `/used-cars/${car.slug}-${car.id}`;
  const email = "acceptance-seller@example.invalid";
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByRole("textbox", { name: "Email or mobile number" }).fill(email);
    await page.getByLabel("Password").fill("AcceptanceOnly123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect.poll(async () => (await page.context().cookies()).some((cookie) => cookie.name === "jw_session")).toBe(true);
    await page.goto(path);
    await page.getByRole("button", { name: "Report this ad" }).click();
    await page.locator('select[name="reason"]').selectOption("fraud");
    await page.getByRole("button", { name: "Send report" }).click();
    await expect(page.getByText("Thanks — we'll take a look.")).toBeVisible();
  }
  const [report] = await sql`
    SELECT count(*)::int AS count, max(r.reporter_anon_id) AS anon_id
    FROM listing_reports r JOIN users u ON u.id = r.reporter_user_id
    WHERE r.listing_id = ${car.id} AND u.email = ${email}
  `;
  expect(report).toMatchObject({ count: 1, anon_id: null });
  const [listing] = await sql`SELECT status FROM listings WHERE id = ${car.id}`;
  expect(listing.status).toBe("active");
});

test("seller submits an inspection request with an initial event", async ({ page, isMobile }) => {
  const device = isMobile ? "mobile" : "desktop";
  const email = `acceptance-seller-${device}@example.invalid`;
  const address = `Acceptance inspection ${device}`;
  await page.goto("/login?next=/inspection");
  await page.getByRole("textbox", { name: "Email or mobile number" }).fill(email);
  await page.getByLabel("Password").fill("AcceptanceOnly123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/inspection(?:\?|$)/);
  await page.locator('select[name="cityId"]').selectOption({ index: 1 });
  await page.locator('input[name="address"]').fill(address);
  await page.locator('input[name="contactPhone"]').fill(isMobile ? "0300 9998882" : "0300 9998881");
  await page.getByRole("button", { name: "Request inspection" }).click();
  await expect(page.getByText("Inspection requested")).toBeVisible();
  const [request] = await sql`
    SELECT i.id, i.status, i.contact_phone FROM inspections i JOIN users u ON u.id = i.requested_by_user_id
    WHERE u.email = ${email} AND i.address = ${address} ORDER BY i.id DESC LIMIT 1
  `;
  expect(request).toMatchObject({ status: "requested", contact_phone: isMobile ? "+923009998882" : "+923009998881" });
  const events = await sql`SELECT to_status, customer_message FROM inspection_events WHERE inspection_id = ${request.id}`;
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ to_status: "requested", customer_message: "Your inspection request has been received." });

  const [account] = await sql`SELECT id FROM users WHERE email = ${email}`;
  const limitKey = rateKey("inspection-request", `identity:user:${account.id}`, 24 * 60 * 60_000);
  await fillRateBucket("inspection-request", `identity:user:${account.id}`, 5, 24 * 60 * 60_000);
  try {
    await page.goto("/inspection");
    await page.locator('select[name="cityId"]').selectOption({ index: 1 });
    await page.locator('input[name="address"]').fill(`${address} blocked`);
    await page.locator('input[name="contactPhone"]').fill("0300 9998881");
    await page.getByRole("button", { name: "Request inspection" }).click();
    await expect(page.getByText("Too many inspection requests. Please try again tomorrow.")).toBeVisible();
    const [blocked] = await sql`SELECT count(*)::int AS count FROM inspections WHERE address = ${`${address} blocked`}`;
    expect(blocked.count).toBe(0);
  } finally {
    await sql`DELETE FROM rate_limit_buckets WHERE key = ${limitKey}`;
  }
});

test("admin inspection update appears to customer without private note", async ({ page, isMobile }) => {
  const device = isMobile ? "mobile" : "desktop";
  const email = `acceptance-seller-${device}@example.invalid`;
  const [request] = await sql`
    SELECT i.id FROM inspections i JOIN users u ON u.id = i.requested_by_user_id
    WHERE u.email = ${email} AND i.address = ${`Acceptance inspection ${device}`}
    ORDER BY i.id DESC LIMIT 1
  `;
  expect(request?.id).toBeGreaterThan(0);
  await page.goto("/login?next=/admin/inspections");
  await page.getByRole("textbox", { name: "Email or mobile number" }).fill("acceptance-admin@example.invalid");
  await page.getByLabel("Password").fill("AcceptanceOnly123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/inspections(?:\?|$)/);
  const row = page.locator("li").filter({ has: page.getByRole("heading", { name: `INS-${request.id}` }) });
  await row.locator('select[name="status"]').selectOption("contacted");
  await row.locator('textarea[name="customerMessage"]').fill(`We called about inspection ${device}.`);
  await row.locator('textarea[name="internalNote"]').fill(`Private inspection note ${device}`);
  await row.getByRole("button", { name: "Save update" }).click();
  await expect.poll(async () => {
    const [updated] = await sql`SELECT status FROM inspections WHERE id = ${request.id}`;
    return updated.status;
  }).toBe("contacted");
  const events = await sql`SELECT from_status, to_status, customer_message, internal_note FROM inspection_events WHERE inspection_id = ${request.id} ORDER BY id`;
  expect(events).toHaveLength(2);
  expect(events[1]).toMatchObject({ from_status: "requested", to_status: "contacted", customer_message: `We called about inspection ${device}.`, internal_note: `Private inspection note ${device}` });

  await page.context().clearCookies();
  await page.goto("/login?next=/dashboard/inspections");
  await page.getByRole("textbox", { name: "Email or mobile number" }).fill(email);
  await page.getByLabel("Password").fill("AcceptanceOnly123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard\/inspections(?:\?|$)/);
  await expect(page.getByText(`We called about inspection ${device}.`)).toBeVisible();
  await expect(page.getByText(`Private inspection note ${device}`)).toHaveCount(0);
});

test("seller submits a structured Sell My Car Assistance request", async ({ page, isMobile }) => {
  const device = isMobile ? "mobile" : "desktop";
  const email = `acceptance-seller-${device}@example.invalid`;
  const address = `Acceptance assistance ${device}`;
  await page.goto("/login?next=/sell-my-car");
  await page.getByRole("textbox", { name: "Email or mobile number" }).fill(email);
  await page.getByLabel("Password").fill("AcceptanceOnly123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/sell-my-car(?:\?|$)/);
  await page.locator('select[name="makeId"]').selectOption({ index: 1 });
  const model = page.locator('select[name="modelId"]');
  await expect.poll(() => model.locator("option").count()).toBeGreaterThan(1);
  await model.selectOption({ index: 1 });
  await page.locator('input[name="year"]').fill("2020");
  await page.locator('input[name="mileageKm"]').fill("65000");
  await page.locator('input[name="registrationCity"]').fill("Lahore");
  await page.locator('select[name="ownershipStatus"]').selectOption("own_name");
  await page.locator('select[name="vehicleCondition"]').selectOption("good");
  await page.locator('input[name="expectedPricePkr"]').fill("4500000");
  await page.locator('select[name="sellingTimeline"]').selectOption("within_month");
  await page.locator('select[name="cityId"]').selectOption({ index: 1 });
  await page.locator('input[name="address"]').fill(address);
  await page.locator('input[name="contactPhone"]').fill(isMobile ? "0300 9998882" : "0300 9998881");
  await page.getByRole("button", { name: "Request Sell My Car Assistance" }).click();
  await expect(page.getByRole("heading", { name: "Request submitted" })).toBeVisible();
  const [request] = await sql`
    SELECT s.id, s.status, s.year, s.mileage_km, s.expected_price_pkr, s.contact_phone
    FROM sell_assistance_requests s JOIN users u ON u.id = s.requested_by_user_id
    WHERE u.email = ${email} AND s.address = ${address} ORDER BY s.id DESC LIMIT 1
  `;
  expect(request).toMatchObject({ status: "requested", year: 2020, mileage_km: 65000, expected_price_pkr: 4500000, contact_phone: isMobile ? "+923009998882" : "+923009998881" });
  const events = await sql`SELECT to_status, customer_message FROM sell_assistance_events WHERE request_id = ${request.id}`;
  expect(events).toHaveLength(1);
  expect(events[0].to_status).toBe("requested");

  const [account] = await sql`SELECT id FROM users WHERE email = ${email}`;
  const limitKey = rateKey("sell-assistance-request", `identity:user:${account.id}`, 24 * 60 * 60_000);
  await fillRateBucket("sell-assistance-request", `identity:user:${account.id}`, 3, 24 * 60 * 60_000);
  try {
    await page.goto("/sell-my-car");
    await page.locator('select[name="makeId"]').selectOption({ index: 1 });
    const modelAgain = page.locator('select[name="modelId"]');
    await expect.poll(() => modelAgain.locator("option").count()).toBeGreaterThan(1);
    await modelAgain.selectOption({ index: 1 });
    await page.locator('input[name="year"]').fill("2020");
    await page.locator('input[name="mileageKm"]').fill("65000");
    await page.locator('input[name="registrationCity"]').fill("Lahore");
    await page.locator('select[name="ownershipStatus"]').selectOption("own_name");
    await page.locator('select[name="vehicleCondition"]').selectOption("good");
    await page.locator('input[name="expectedPricePkr"]').fill("4500000");
    await page.locator('select[name="sellingTimeline"]').selectOption("within_month");
    await page.locator('select[name="cityId"]').selectOption({ index: 1 });
    await page.locator('input[name="address"]').fill(`${address} blocked`);
    await page.locator('input[name="contactPhone"]').fill("0300 9998881");
    await page.getByRole("button", { name: "Request Sell My Car Assistance" }).click();
    await expect(page.getByText("Too many assistance requests. Please try again tomorrow.")).toBeVisible();
    const [blocked] = await sql`SELECT count(*)::int AS count FROM sell_assistance_requests WHERE address = ${`${address} blocked`}`;
    expect(blocked.count).toBe(0);
  } finally {
    await sql`DELETE FROM rate_limit_buckets WHERE key = ${limitKey}`;
  }
});

test("admin assistance update is visible to customer without private note", async ({ page, isMobile }) => {
  const device = isMobile ? "mobile" : "desktop";
  const email = `acceptance-seller-${device}@example.invalid`;
  const [request] = await sql`
    SELECT s.id FROM sell_assistance_requests s JOIN users u ON u.id = s.requested_by_user_id
    WHERE u.email = ${email} AND s.address = ${`Acceptance assistance ${device}`}
    ORDER BY s.id DESC LIMIT 1
  `;
  expect(request?.id).toBeGreaterThan(0);
  await page.goto("/login?next=/admin/sell-assistance");
  await page.getByRole("textbox", { name: "Email or mobile number" }).fill("acceptance-admin@example.invalid");
  await page.getByLabel("Password").fill("AcceptanceOnly123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/sell-assistance(?:\?|$)/);
  const row = page.locator("li").filter({ has: page.getByRole("heading", { name: new RegExp(`SMC-${request.id}\\b`) }) });
  await row.locator('select[name="status"]').selectOption("contacted");
  await row.locator('textarea[name="customerMessage"]').fill(`We called about your car ${device}.`);
  await row.locator('textarea[name="internalNote"]').fill(`Private assistance note ${device}`);
  await row.getByRole("button", { name: "Save update" }).click();
  await expect.poll(async () => {
    const [updated] = await sql`SELECT status FROM sell_assistance_requests WHERE id = ${request.id}`;
    return updated.status;
  }).toBe("contacted");
  const events = await sql`SELECT from_status, to_status, customer_message, internal_note FROM sell_assistance_events WHERE request_id = ${request.id} ORDER BY id`;
  expect(events).toHaveLength(2);
  expect(events[1]).toMatchObject({ from_status: "requested", to_status: "contacted", customer_message: `We called about your car ${device}.`, internal_note: `Private assistance note ${device}` });

  await page.context().clearCookies();
  await page.goto("/login?next=/dashboard/sell-assistance");
  await page.getByRole("textbox", { name: "Email or mobile number" }).fill(email);
  await page.getByLabel("Password").fill("AcceptanceOnly123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard\/sell-assistance(?:\?|$)/);
  await expect(page.getByText(`We called about your car ${device}.`)).toBeVisible();
  await expect(page.getByText(`Private assistance note ${device}`)).toHaveCount(0);
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

test("public contact and report limits prevent excess writes", async ({ page, isMobile }) => {
  const anon = randomBytes(16).toString("hex");
  const base = process.env.ACCEPTANCE_BASE_URL;
  if (!base) throw new Error("Acceptance base URL is required");
  await page.context().addCookies([{ name: "jw_anon", value: anon, url: base, httpOnly: true }]);
  const [listing] = await sql`
    SELECT id, slug, lead_count FROM listings WHERE vertical = 'car' AND status = 'active'
    ORDER BY id LIMIT 1 OFFSET ${isMobile ? 11 : 12}
  `;
  expect(listing?.id).toBeGreaterThan(0);
  await fillRateBucket("seller-contact", `identity:anon:${anon}`, 60, 60 * 60_000);
  await page.goto(`/used-cars/${listing.slug}-${listing.id}`);
  await page.getByRole("button", { name: /Show number/ }).click();
  await expect(page.getByText("Too many contact requests. Please try again later.")).toBeVisible();
  const [afterReveal] = await sql`SELECT lead_count FROM listings WHERE id = ${listing.id}`;
  expect(afterReveal.lead_count).toBe(listing.lead_count);

  await fillRateBucket("listing-report", `identity:anon:${anon}`, 5, 60 * 60_000);
  await page.getByRole("button", { name: "Report this ad" }).click();
  await page.locator('select[name="reason"]').selectOption("spam");
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page.getByText("Too many reports. Please try again later.")).toBeVisible();
  const [reports] = await sql`SELECT count(*)::int AS count FROM listing_reports WHERE listing_id = ${listing.id}`;
  expect(reports.count).toBe(0);
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

test("admin hides, reinstates and permanently removes a seller car", async ({ page, isMobile }) => {
  const device = isMobile ? "mobile" : "desktop";
  const [listing] = await sql`
    SELECT l.id, l.slug FROM listings l JOIN users u ON u.id = l.seller_id
    WHERE u.email = ${`acceptance-seller-${device}@example.invalid`} AND l.vertical = 'car' AND l.status = 'active'
    ORDER BY l.id DESC LIMIT 1
  `;
  expect(listing?.id).toBeGreaterThan(0);
  const listingPath = `/used-cars/${listing.slug}-${listing.id}`;
  await page.goto("/login?next=/admin/listings");
  await page.getByRole("textbox", { name: "Email or mobile number" }).fill("acceptance-admin@example.invalid");
  await page.getByLabel("Password").fill("AcceptanceOnly123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/listings(?:\?|$)/);
  const row = () => page.locator("article").filter({ has: page.locator(`a[href="${listingPath}"]`) });
  await row().locator("textarea").fill(`Safety review acceptance ${device}`);
  await row().getByRole("button", { name: "Flag / hide" }).click();
  await expect.poll(async () => (await sql`SELECT status FROM listings WHERE id = ${listing.id}`)[0].status).toBe("pending_review");
  expect((await page.request.get(listingPath)).status()).toBe(404);

  await page.reload();
  await row().locator("textarea").fill(`Review cleared acceptance ${device}`);
  await row().getByRole("button", { name: "Reinstate" }).click();
  await expect.poll(async () => (await sql`SELECT status FROM listings WHERE id = ${listing.id}`)[0].status).toBe("active");
  expect((await page.request.get(listingPath)).status()).toBe(200);

  await page.reload();
  await row().locator("textarea").fill(`Final removal acceptance ${device}`);
  await row().getByRole("button", { name: "Remove" }).click();
  await expect.poll(async () => (await sql`SELECT status FROM listings WHERE id = ${listing.id}`)[0].status).toBe("removed");
  expect((await page.request.get(listingPath)).status()).toBe(404);
  const events = await sql`
    SELECT action, reason FROM moderation_log WHERE listing_id = ${listing.id}
    AND action IN ('flag', 'reinstate', 'remove') ORDER BY id
  `;
  expect(events.map((event) => event.action)).toEqual(["flag", "reinstate", "remove"]);
  expect(events[2].reason).toBe(`Final removal acceptance ${device}`);
});

test("administrator ban revokes sessions and restoration permits login", async ({ page, isMobile }) => {
  const device = isMobile ? "mobile" : "desktop";
  const email = `acceptance-seller-${device}@example.invalid`;
  const [seller] = await sql`SELECT id FROM users WHERE email = ${email}`;
  await page.goto("/login?next=/dashboard");
  await page.getByRole("textbox", { name: "Email or mobile number" }).fill(email);
  await page.getByLabel("Password").fill("AcceptanceOnly123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
  const [before] = await sql`SELECT count(*)::int AS count FROM sessions WHERE user_id = ${seller.id}`;
  expect(before.count).toBeGreaterThan(0);

  for (let attempt = 0; attempt < 2; attempt++) {
    await page.context().clearCookies();
    await page.goto("/login?next=/admin/users");
    if (new URL(page.url()).pathname === "/login") break;
  }
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByRole("textbox", { name: "Email or mobile number" }).fill("acceptance-admin@example.invalid");
  await page.getByLabel("Password").fill("AcceptanceOnly123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/users(?:\?|$)/);
  const row = () => page.locator("article").filter({ hasText: email });
  await row().getByPlaceholder("Ban reason (required)").fill(`Ban acceptance ${device}`);
  await row().getByRole("button", { name: "Ban user" }).click();
  await expect.poll(async () => (await sql`SELECT is_banned FROM users WHERE id = ${seller.id}`)[0].is_banned).toBe(true);
  const [revoked] = await sql`SELECT count(*)::int AS count FROM sessions WHERE user_id = ${seller.id}`;
  expect(revoked.count).toBe(0);

  await page.reload();
  await row().getByPlaceholder("Restoration reason (required)").fill(`Restore acceptance ${device}`);
  await row().getByRole("button", { name: "Restore access" }).click();
  await expect.poll(async () => (await sql`SELECT is_banned FROM users WHERE id = ${seller.id}`)[0].is_banned).toBe(false);
  const events = await sql`SELECT action FROM moderation_log WHERE user_id = ${seller.id} AND action IN ('ban', 'unban') ORDER BY id`;
  expect(events.slice(-2).map((event) => event.action)).toEqual(["ban", "unban"]);
  await page.context().clearCookies();
  await page.goto("/login?next=/dashboard");
  await page.getByRole("textbox", { name: "Email or mobile number" }).fill(email);
  await page.getByLabel("Password").fill("AcceptanceOnly123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
});

test("five independent reports hide an ad until administrator review", async ({ page, browser, isMobile }) => {
  const device = isMobile ? "mobile" : "desktop";
  const [listing] = await sql`
    SELECT l.id, l.slug FROM listings l JOIN users u ON u.id = l.seller_id
    WHERE u.email = ${`acceptance-seller-${device}@example.invalid`} AND l.vertical = 'part' AND l.status = 'active'
    ORDER BY l.id DESC LIMIT 1
  `;
  expect(listing?.id).toBeGreaterThan(0);
  const listingPath = `/auto-parts/${listing.slug}-${listing.id}`;
  for (let reporter = 1; reporter <= 5; reporter++) {
    await page.context().clearCookies();
    await page.goto(listingPath);
    await page.getByRole("button", { name: "Report this ad" }).click();
    await page.locator('select[name="reason"]').selectOption("fraud");
    await page.locator('textarea[name="comment"]').fill(`Independent report ${reporter} ${device}`);
    await page.getByRole("button", { name: "Send report" }).click();
    if (reporter < 5) await expect(page.getByText("Thanks — we'll take a look.")).toBeVisible();
    else {
      await expect(page).toHaveURL(/\/report-concern\?submitted=1$/);
      await expect(page.getByRole("status")).toContainText("Report received");
    }
    const [reported] = await sql`SELECT count(*)::int AS count FROM listing_reports WHERE listing_id = ${listing.id} AND status = 'open'`;
    expect(reported.count).toBe(reporter);
    const [current] = await sql`SELECT status FROM listings WHERE id = ${listing.id}`;
    expect(current.status).toBe(reporter === 5 ? "pending_review" : "active");
    if (reporter === 1) {
      await page.reload();
      await page.getByRole("button", { name: "Report this ad" }).click();
      await page.locator('select[name="reason"]').selectOption("spam");
      await page.getByRole("button", { name: "Send report" }).click();
      await expect(page.getByText("Thanks — we'll take a look.")).toBeVisible();
      const [duplicate] = await sql`SELECT count(*)::int AS count FROM listing_reports WHERE listing_id = ${listing.id}`;
      expect(duplicate.count).toBe(1);
    }
  }
  expect((await page.request.get(listingPath)).status()).toBe(404);
  const [queued] = await sql`SELECT count(*)::int AS count FROM moderation_log WHERE listing_id = ${listing.id} AND action = 'queue' AND is_automated = true`;
  expect(queued.count).toBe(1);

  await page.context().clearCookies();
  await page.goto("/login?next=/admin/moderation");
  await page.getByRole("textbox", { name: "Email or mobile number" }).fill("acceptance-admin@example.invalid");
  await page.getByLabel("Password").fill("AcceptanceOnly123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/moderation(?:\?|$)/);
  const row = page.locator("li").filter({ has: page.locator(`a[href="${listingPath}"]`) }).first();
  await row.getByRole("button", { name: "Approve" }).click();
  await expect.poll(async () => (await sql`SELECT status FROM listings WHERE id = ${listing.id}`)[0].status).toBe("active");
  const [resolved] = await sql`SELECT count(*)::int AS count FROM listing_reports WHERE listing_id = ${listing.id} AND status = 'dismissed'`;
  expect(resolved.count).toBe(5);
  expect((await page.request.get(listingPath)).status()).toBe(200);

  // Start a new review cycle and submit the fifth and sixth reports at once.
  for (let reporter = 0; reporter < 4; reporter++) {
    await page.context().clearCookies();
    await page.goto(listingPath);
    await page.getByRole("button", { name: "Report this ad" }).click();
    await page.locator('select[name="reason"]').selectOption("spam");
    await page.getByRole("button", { name: "Send report" }).click();
    await expect(page.getByText("Thanks — we'll take a look.")).toBeVisible();
  }
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  try {
    const pages = await Promise.all(contexts.map((context) => context.newPage()));
    await Promise.all(pages.map(async (reportPage) => {
      await reportPage.goto(listingPath);
      await reportPage.getByRole("button", { name: "Report this ad" }).click();
      await reportPage.locator('select[name="reason"]').selectOption("fraud");
    }));
    await Promise.all(pages.map((reportPage) => reportPage.getByRole("button", { name: "Send report" }).click()));
    await expect.poll(async () => {
      const [row] = await sql`SELECT count(*)::int AS count FROM listing_reports WHERE listing_id = ${listing.id} AND status = 'open'`;
      return row.count;
    }).toBe(5);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
  const [concurrent] = await sql`SELECT count(*)::int AS count FROM listing_reports WHERE listing_id = ${listing.id} AND status = 'open'`;
  expect(concurrent.count).toBe(5);
  const [queuedTwice] = await sql`SELECT count(*)::int AS count FROM moderation_log WHERE listing_id = ${listing.id} AND action = 'queue' AND is_automated = true`;
  expect(queuedTwice.count).toBe(2);
  const [held] = await sql`SELECT status FROM listings WHERE id = ${listing.id}`;
  expect(held.status).toBe("pending_review");
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

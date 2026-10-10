import { expect, test } from "@playwright/test";
import "dotenv/config";
import { randomUUID } from "node:crypto";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url || !/(?:_test|_acceptance)$/.test(new URL(url).pathname.slice(1))) throw new Error("Retention browser tests require an isolated database");
const sql = postgres(url, { max: 1 });
test.afterAll(async () => { await sql.end(); });

test("retention admin holds require admin access and support review and release", async ({ page }) => {
  const tag = randomUUID();
  const [user] = await sql`INSERT INTO users(email) VALUES (${tag+'@example.invalid'}) RETURNING id`;
  try {
    await page.goto("/admin/retention");
    await expect(page).toHaveURL(/\/login/);
    await page.getByRole("textbox", { name: "Email or mobile number" }).fill("acceptance-admin@example.invalid");
    await page.getByLabel("Password").fill("AcceptanceOnly123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin\/retention/);
    await page.getByLabel("Record ID").fill(String(user.id));
    await page.getByLabel("Reason", { exact: true }).fill(`Complaint evidence ${tag}`);
    await page.getByLabel("Responsible person").fill("Acceptance reviewer");
    await page.getByRole("button", { name: "Create hold" }).click();
    const row = page.getByRole("listitem").filter({ hasText: tag });
    await expect(row).toBeVisible();
    await sql`UPDATE retention_holds SET reviewed_at=NOW()-INTERVAL '91 days' WHERE resource='account' AND resource_id=${user.id}`;
    await page.reload();
    await row.getByRole("button", { name: "Record review" }).click();
    await expect.poll(async () => new Date((await sql`SELECT reviewed_at FROM retention_holds WHERE resource='account' AND resource_id=${user.id}`)[0].reviewed_at).getTime()).toBeGreaterThan(Date.now()-60_000);
    await row.getByRole("button", { name: "Release hold" }).click();
    await expect(row).toHaveCount(0);
  } finally {
    await sql`DELETE FROM retention_runs WHERE summary->>'holdId' IN (SELECT id::text FROM retention_holds WHERE resource='account' AND resource_id=${user.id})`;
    await sql`DELETE FROM retention_holds WHERE resource='account' AND resource_id=${user.id}`;
    await sql`DELETE FROM users WHERE id=${user.id}`;
  }
});

test("retention closure revokes sessions and authenticated recovery restores access", async ({ page, browser, isMobile }) => {
  const email = `retention-${randomUUID()}@example.invalid`;
  const [user] = await sql`INSERT INTO users(name,email,email_verified_at,password_hash)
    SELECT 'Retention acceptance',${email},NOW(),password_hash FROM users
    WHERE email=${`acceptance-seller-${isMobile ? "mobile" : "desktop"}@example.invalid`} RETURNING id`;
  expect(user?.id).toBeGreaterThan(0);
  const login = async () => {
    await page.goto("/login?next=/dashboard/profile");
    await page.getByRole("textbox", { name: "Email or mobile number" }).fill(email);
    await page.getByLabel("Password").fill("AcceptanceOnly123!");
    await page.getByRole("button", { name: "Sign in" }).click();
  };
  const other = await browser.newContext();
  try {
    await login();
    await expect(page).toHaveURL(/\/dashboard\/profile/);
    await other.addCookies(await page.context().cookies());
    await page.getByLabel("Type CLOSE to confirm").fill("CLOSE");
    await page.getByRole("button", { name: "Close my account", exact: true }).click();
    await expect(page).toHaveURL(/\/account\/closed/);
    expect(Number((await sql`SELECT count(*) n FROM sessions WHERE user_id=${user.id}`)[0].n)).toBe(0);
    const second = await other.newPage();
    await second.goto(new URL("/dashboard/profile", page.url()).href);
    await expect(second).toHaveURL(/\/login/);
    const publicProfile = await page.request.get(`/sellers/${user.id}`);
    expect(publicProfile.status()).toBe(404);
    await login();
    await expect(page).toHaveURL(/\/account\/restore/);
    await page.getByRole("button", { name: "Restore my account" }).click();
    await expect(page).toHaveURL(/\/dashboard\/profile/);
    expect((await sql`SELECT closed_at FROM users WHERE id=${user.id}`)[0].closed_at).toBeNull();
  } finally {
    await other.close();
    await sql`DELETE FROM retention_receipts WHERE resource='account' AND resource_id=${user.id}`;
    await sql`DELETE FROM sessions WHERE user_id=${user.id}`;
    await sql`DELETE FROM users WHERE id=${user.id}`;
  }
});

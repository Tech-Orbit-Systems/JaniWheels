import "dotenv/config";
import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";
import sharp from "sharp";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !/(?:_test|_acceptance)$/.test(new URL(databaseUrl).pathname.slice(1))) {
  throw new Error("Upload acceptance requires an isolated test database");
}
const sql = postgres(databaseUrl, { max: 1 });
test.afterAll(async () => { await sql.end(); });

test("six photos upload in bounded batches while invalid bulk requests leave no files", async ({ page, isMobile }) => {
  const email = `prelaunch-upload-${isMobile ? "mobile" : "desktop"}-${randomUUID()}@example.invalid`;
  const [owner] = await sql`INSERT INTO users(name,email,email_verified_at,password_hash)
    SELECT 'Upload acceptance',${email},NOW(),password_hash FROM users
    WHERE email='acceptance-seller@example.invalid' RETURNING id`;
  expect(owner).toBeTruthy();
  await sql`UPDATE users SET phone=${`+923${String(owner.id).padStart(9, "0")}`} WHERE id=${owner.id}`;
  const photo = await sharp({ create: { width: 24, height: 24, channels: 3, background: "#557744" } }).png().toBuffer();
  const requests: string[] = [];
  page.on("request", (request) => { if (request.method() === "POST" && request.url().endsWith("/api/upload")) requests.push(request.url()); });
  try {
    await page.goto("/login?next=/sell/part");
    await page.getByRole("textbox", { name: "Email or mobile number" }).fill(email);
    await page.getByLabel("Password").fill("AcceptanceOnly123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/sell/part");
    await page.locator('input[type="file"]').setInputFiles(Array.from({ length: 6 }, (_, index) => ({
      name: `photo-${index}.png`, mimeType: "image/png", buffer: photo,
    })));
    await expect(page.getByText("6 photos added")).toBeVisible();
    expect(requests).toHaveLength(2);
    const accepted = await sql`SELECT storage_key FROM pending_uploads WHERE user_id=${owner.id}`;
    expect(accepted).toHaveLength(6);
    const denied = await page.evaluate(async () => {
      const form = new FormData();
      for (let index = 0; index < 6; index++) form.append("files", new File([new Uint8Array([1, 2, 3])], `bad-${index}.png`, { type: "image/png" }));
      const response = await fetch("/api/upload", { method: "POST", body: form });
      return { status: response.status, data: await response.json() };
    });
    expect(denied.status).toBe(400);
    expect(denied.data.error).toContain("five files");
    const wrongType = await page.evaluate(async () => {
      const response = await fetch("/api/upload", { method: "POST", body: "not multipart" });
      return response.status;
    });
    expect(wrongType).toBe(415);
    const after = await sql`SELECT storage_key FROM pending_uploads WHERE user_id=${owner.id}`;
    expect(after).toHaveLength(6);
  } finally {
    const rows = await sql`SELECT storage_key FROM pending_uploads WHERE user_id=${owner.id}`;
    for (const row of rows) {
      await sql`DELETE FROM pending_uploads WHERE storage_key=${row.storage_key}`;
      if (process.env.UPLOAD_DIR) await rm(join(process.env.UPLOAD_DIR, row.storage_key), { force: true });
    }
    await sql`DELETE FROM sessions WHERE user_id=${owner.id}`;
    await sql`DELETE FROM users WHERE id=${owner.id}`;
  }
});

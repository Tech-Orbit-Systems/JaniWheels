import "dotenv/config";
import { expect, test } from "@playwright/test";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !/(?:_test|_acceptance)$/.test(new URL(databaseUrl).pathname.slice(1))) {
  throw new Error("Recovery tests require an isolated acceptance database");
}
const sql = postgres(databaseUrl, { max: 1 });
test.afterAll(async () => { await sql.end(); });
test.describe.configure({ mode: "serial" });

// This project depends on the other browser projects so fault injection never
// overlaps ordinary acceptance. No application fault switch is shipped.
for (const route of ["used-cars", "used-bikes", "auto-parts"]) {
  test(`${route} recovers after a database read failure`, async ({ page, baseURL }) => {
    expect(["127.0.0.1", "localhost"]).toContain(new URL(baseURL!).hostname);
    let renamed = false;
    try {
      await sql`ALTER TABLE listings RENAME TO acceptance_unavailable_listings`;
      renamed = true;
      await page.goto(`/${route}`);
      await expect(page.getByRole("heading", { name: /listings are temporarily unavailable/ })).toBeVisible();
      await expect(page.getByRole("button", { name: "Try again", exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "Clear filters", exact: true })).toHaveAttribute("href", `/${route}`);
      await expect(page.locator("body")).not.toContainText("acceptance_unavailable_listings");
      await sql`ALTER TABLE acceptance_unavailable_listings RENAME TO listings`;
      renamed = false;
      await page.getByRole("button", { name: "Try again", exact: true }).click();
      await expect(page.getByRole("heading", { name: /listings are temporarily unavailable/ })).toHaveCount(0);
      await expect(page.locator(`a[href^="/${route}/"]`).first()).toBeVisible();
    } finally {
      if (renamed) await sql`ALTER TABLE acceptance_unavailable_listings RENAME TO listings`;
    }
  });
}

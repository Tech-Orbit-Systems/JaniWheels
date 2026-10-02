import { defineConfig, devices } from "@playwright/test";

const workerOverride = process.env.PLAYWRIGHT_WORKERS;
if (workerOverride && !/^[1-9]\d*$/.test(workerOverride)) {
  throw new Error("PLAYWRIGHT_WORKERS must be a positive whole number");
}

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  workers: workerOverride ? Number(workerOverride) : process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.ACCEPTANCE_BASE_URL ?? "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop-chromium", testIgnore: "**/webkit-smoke.spec.ts", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", testIgnore: "**/webkit-smoke.spec.ts", use: { ...devices["Pixel 7"] } },
    { name: "mobile-webkit", testMatch: "**/webkit-smoke.spec.ts", use: { ...devices["iPhone 13"] } },
  ],
});

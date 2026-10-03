/** Run DB and browser acceptance against a dedicated local PostgreSQL database. */
import "dotenv/config";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import postgres from "postgres";

const source = process.env.DATABASE_URL;
if (!source) throw new Error("DATABASE_URL is required");
const target = new URL(source);
target.pathname = "/janiwheels_acceptance_test";
if (new URL(source).pathname === target.pathname) {
  throw new Error("Run acceptance from the normal local database URL, not the acceptance database");
}
const base = "http://127.0.0.1:3101";
const env = {
  ...process.env,
  DATABASE_URL: target.toString(),
  NEXT_PUBLIC_SITE_URL: base,
  NEXT_DIST_DIR: ".next-build",
  IMAGE_PROVIDER: "local",
  UPLOAD_DIR: resolve(".acceptance-uploads"),
  ACCEPTANCE_EMAIL_DIR: resolve(".acceptance-mail"),
  CRON_SECRET: "local-acceptance-cron-only",
  ACCEPTANCE_BASE_URL: base,
  SWEEP_BASE: base,
};
await mkdir(env.UPLOAD_DIR, { recursive: true });

function command(args: string[]): Promise<void> {
  return new Promise((done, reject) => {
    const windows = process.platform === "win32";
    const child = spawn(windows ? "cmd.exe" : "npm", windows ? ["/d", "/s", "/c", `npm ${args.join(" ")}`] : args, {
      env, stdio: "inherit",
    });
    child.once("exit", (code) => code === 0 ? done() : reject(new Error(`${args.join(" ")} failed (${code})`)));
    child.once("error", reject);
  });
}

let server: ChildProcess | undefined;
try {
  if (!process.argv.includes("--browser-only")) {
    // Every full run starts clean so old report and audit references cannot block demo reseeding.
    const adminUrl = new URL(source);
    adminUrl.pathname = "/postgres";
    const admin = postgres(adminUrl.toString(), { max: 1 });
    try {
      await admin.unsafe('DROP DATABASE IF EXISTS "janiwheels_acceptance_test" WITH (FORCE)');
      await admin.unsafe('CREATE DATABASE "janiwheels_acceptance_test"');
    } finally {
      await admin.end();
    }
    await command(["run", "db:migrate"]);
    await command(["run", "db:seed"]);
    await new Promise<void>((done, reject) => {
      const child = spawn(process.execPath, ["--import", "tsx", "src/db/seed/demo.ts"], { env, stdio: "inherit" });
      child.once("exit", (code) => code === 0 ? done() : reject(new Error(`demo seed failed (${code})`)));
      child.once("error", reject);
    });
    await command(["run", "test:db"]);
    if (process.argv.includes("--database-only")) process.exit(0);
    await command(["run", "build:safe"]);
  }
  if (!process.argv.includes("--browser-only")) {
    await new Promise<void>((done, reject) => {
      const child = spawn(process.execPath, ["--import", "tsx", "scripts/seed-acceptance-accounts.ts"], { env, stdio: "inherit" });
      child.once("exit", (code) => code === 0 ? done() : reject(new Error(`account seed failed (${code})`)));
      child.once("error", reject);
    });
  }
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", "3101"], {
    env, stdio: "inherit",
  });
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error(`Acceptance server exited (${server.exitCode})`);
    try {
      const response = await fetch(base);
      if (response.ok) { ready = true; break; }
    } catch { /* startup still in progress */ }
    await new Promise((done) => setTimeout(done, 2000));
  }
  if (!ready) throw new Error("Acceptance server did not become ready");
  await command(["run", "sweep"]);
  if (process.argv.includes("--load-only")) {
    await command(["run", "test:load-smoke"]);
    server.kill();
    process.exit(0);
  }
  const grepIndex = process.argv.indexOf("--grep");
  const grep = grepIndex >= 0 ? process.argv[grepIndex + 1] : undefined;
  await command(process.argv.includes("--launch-gaps-only")
    ? ["run", "test:e2e", "--", "tests/e2e/launch-gaps.spec.ts", "--project=desktop-chromium", "--project=mobile-chromium", "--no-deps"]
    : process.argv.includes("--recovery-only")
    ? ["run", "test:e2e", "--", "--project=recovery-chromium", "--no-deps"]
    : grep ? ["run", "test:e2e", "--", "--project=desktop-chromium", "--project=mobile-chromium", "--no-deps", "--grep", grep] : ["run", "test:e2e"]);
} finally {
  server?.kill();
}

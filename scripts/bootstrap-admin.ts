import "dotenv/config";
import postgres from "postgres";
import { bootstrapAdmin, BootstrapInputError } from "./lib/bootstrap-admin";

const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log("Usage: npm run admin:bootstrap -- --email owner@example.com --database DATABASE_NAME [--apply]");
  console.log("Default: validate and preview only. --apply grants the first administrator role and records an audit event.");
} else {
  try {
    const options = new Map<string, string>();
    let apply = false;
    for (let index = 0; index < args.length; index++) {
      const arg = args[index];
      if (arg === "--apply" && !apply) { apply = true; continue; }
      if (!["--email", "--database"].includes(arg) || options.has(arg) || !args[index + 1] || args[index + 1].startsWith("--")) {
        throw new BootstrapInputError("Invalid arguments. Run with --help for usage.");
      }
      options.set(arg, args[++index]);
    }
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new BootstrapInputError("DATABASE_URL is required.");
    const databaseName = decodeURIComponent(new URL(databaseUrl).pathname.slice(1));
    if (!databaseName || options.get("--database") !== databaseName) throw new BootstrapInputError("--database must exactly match the target database name.");
    const email = options.get("--email");
    if (!email) throw new BootstrapInputError("--email is required.");
    const sql = postgres(databaseUrl, { max: 1 });
    try {
      const result = await bootstrapAdmin(sql, email, apply);
      console.log(JSON.stringify({ database: databaseName, ...result }));
    } finally { await sql.end(); }
  } catch (error) {
    // Driver errors can contain connection information; only display our own validation errors.
    const known = error instanceof BootstrapInputError;
    console.error(known ? error.message : "Administrator provisioning failed. Check the database configuration and operator logs without sharing credentials.");
    process.exitCode = 1;
  }
}

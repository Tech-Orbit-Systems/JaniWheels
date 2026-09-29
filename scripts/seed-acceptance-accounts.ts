/** Browser-test accounts exist only in the isolated acceptance database. */
import "dotenv/config";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
if (!/(?:_test|_acceptance)$/.test(new URL(url).pathname.slice(1))) {
  throw new Error("Acceptance accounts require an isolated test database");
}
const scrypt = promisify(scryptCallback);
const salt = randomBytes(16).toString("base64url");
const key = await scrypt("AcceptanceOnly123!", salt, 64) as Buffer;
const passwordHash = `scrypt:${salt}:${key.toString("base64url")}`;
const sql = postgres(url, { max: 1 });
try {
  for (const [role, admin] of [["seller", false], ["dealer-desktop", false], ["dealer-mobile", false], ["admin", true]] as const) {
    const email = `acceptance-${role}@example.invalid`;
    if (role.startsWith("dealer")) {
      await sql`DELETE FROM dealers WHERE user_id IN (SELECT id FROM users WHERE email = ${email})`;
    }
    await sql`
      INSERT INTO users (email, name, password_hash, email_verified_at, is_admin, type)
      VALUES (${email}, ${`Acceptance ${role}`}, ${passwordHash}, now(), ${admin}, 'individual')
      ON CONFLICT (email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        email_verified_at = EXCLUDED.email_verified_at,
        is_admin = EXCLUDED.is_admin,
        type = EXCLUDED.type
    `;
  }
  console.log("Acceptance seller, dealer and admin accounts ready");
} finally {
  await sql.end();
}

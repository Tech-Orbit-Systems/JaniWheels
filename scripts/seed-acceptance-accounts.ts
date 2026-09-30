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
  for (const [role, admin] of [["seller", false], ["seller-desktop", false], ["seller-mobile", false], ["dealer-desktop", false], ["dealer-mobile", false], ["admin", true], ["unverified", false], ["banned", false]] as const) {
    const email = `acceptance-${role}@example.invalid`;
    if (role.startsWith("seller-")) {
      await sql`DELETE FROM inspections WHERE requested_by_user_id IN (SELECT id FROM users WHERE email = ${email})`;
      await sql`DELETE FROM sell_assistance_requests WHERE requested_by_user_id IN (SELECT id FROM users WHERE email = ${email})`;
      await sql`DELETE FROM moderation_log WHERE listing_id IN (SELECT id FROM listings WHERE seller_id IN (SELECT id FROM users WHERE email = ${email}))`;
      await sql`DELETE FROM listings WHERE seller_id IN (SELECT id FROM users WHERE email = ${email})`;
    }
    if (role.startsWith("dealer")) {
      await sql`DELETE FROM dealers WHERE user_id IN (SELECT id FROM users WHERE email = ${email})`;
    }
    const phone = role === "seller-desktop" ? "+923009998881" : role === "seller-mobile" ? "+923009998882" : null;
    await sql`
      INSERT INTO users (email, name, phone, password_hash, email_verified_at, is_admin, is_banned, type)
      VALUES (${email}, ${`Acceptance ${role}`}, ${phone}, ${passwordHash}, ${role === "unverified" ? null : new Date()}, ${admin}, ${role === "banned"}, 'individual')
      ON CONFLICT (email) DO UPDATE SET
        phone = EXCLUDED.phone,
        password_hash = EXCLUDED.password_hash,
        email_verified_at = EXCLUDED.email_verified_at,
        is_admin = EXCLUDED.is_admin,
        is_banned = EXCLUDED.is_banned,
        type = EXCLUDED.type
    `;
    if (role === "unverified" || role === "banned") {
      await sql`DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email = ${email})`;
    }
  }
  const reviewListings = await sql`
    SELECT id FROM listings
    WHERE vertical = 'car'
      AND seller_id IN (SELECT id FROM users WHERE phone IN ('+923001234567', '+923219876543', '+923334455667', '+923455667788'))
    ORDER BY id LIMIT 2
  `;
  if (reviewListings.length !== 2) throw new Error("Demo cars are required for moderation acceptance");
  for (const row of reviewListings) {
    await sql`UPDATE listings SET status = 'pending_review' WHERE id = ${row.id}`;
  }
  console.log("Acceptance seller, dealer and admin accounts ready");
} finally {
  await sql.end();
}

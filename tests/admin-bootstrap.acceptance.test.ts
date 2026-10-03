import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { bootstrapAdmin } from "../scripts/lib/bootstrap-admin";

test("first administrator bootstrap is explicit, audited, atomic and serialized", async () => {
  const url = process.env.DATABASE_URL;
  assert.ok(url);
  assert.match(new URL(url).pathname.slice(1), /(?:_test|_acceptance)$/);
  const schema = `bootstrap_${randomUUID().replaceAll("-", "")}`;
  assert.match(schema, /^bootstrap_[a-f0-9]{32}$/);
  const control = postgres(url, { max: 1 });
  const sql = postgres(url, { max: 2, connection: { search_path: schema } });
  try {
    await control.unsafe(`CREATE SCHEMA "${schema}"`);
    // Clone current migrated tables into a private namespace so browser/admin fixtures are untouched.
    for (const table of ["users", "sessions", "moderation_log"]) {
      await control.unsafe(`CREATE TABLE "${schema}"."${table}" (LIKE public."${table}" INCLUDING ALL)`);
    }
    const accounts = await sql`INSERT INTO users (email,email_verified_at) VALUES ('first@example.invalid',NOW()),('second@example.invalid',NOW()) RETURNING id,email`;
    for (const row of accounts) await sql`INSERT INTO sessions (id,user_id,expires_at) VALUES (${`session-${row.id}`},${row.id},NOW()+INTERVAL '1 day')`;
    await assert.rejects(bootstrapAdmin(sql, "not-an-email", true), /valid existing/);
    await assert.rejects(bootstrapAdmin(sql, "missing@example.invalid", true), /unique account/);
    await sql`UPDATE users SET email_verified_at=NULL WHERE id=${accounts[0].id}`;
    await assert.rejects(bootstrapAdmin(sql, accounts[0].email, true), /Verify this account/);
    await sql`UPDATE users SET email_verified_at=NOW(),is_banned=true WHERE id=${accounts[0].id}`;
    await assert.rejects(bootstrapAdmin(sql, accounts[0].email, true), /banned account/);
    await sql`UPDATE users SET is_banned=false WHERE id=${accounts[0].id}`;
    assert.equal((await bootstrapAdmin(sql, " FIRST@example.invalid ", false)).status, "dry-run");
    assert.equal((await sql`SELECT id FROM users WHERE is_admin=true`).length, 0);
    assert.equal((await sql`SELECT id FROM moderation_log`).length, 0);
    assert.equal((await sql`SELECT id FROM sessions`).length, 2);

    await sql`ALTER TABLE moderation_log ADD CONSTRAINT reject_bootstrap CHECK (action <> 'admin_bootstrap')`;
    await assert.rejects(bootstrapAdmin(sql, accounts[0].email, true));
    assert.equal((await sql`SELECT id FROM users WHERE is_admin=true`).length, 0);
    assert.equal((await sql`SELECT id FROM sessions`).length, 2);
    await sql`ALTER TABLE moderation_log DROP CONSTRAINT reject_bootstrap`;

    const results = await Promise.allSettled(accounts.map((row) => bootstrapAdmin(sql, row.email, true)));
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    const [winner] = await sql`SELECT id,email FROM users WHERE is_admin=true`;
    const audit = await sql`SELECT user_id,moderator_id,action,metadata FROM moderation_log`;
    assert.equal(audit.length, 1);
    assert.equal(audit[0].user_id, winner.id);
    assert.equal(audit[0].moderator_id, null);
    assert.equal(audit[0].action, "admin_bootstrap");
    assert.equal(audit[0].metadata.source, "bootstrap-admin-cli");
    assert.equal((await sql`SELECT id FROM sessions WHERE user_id=${winner.id}`).length, 0);
    assert.equal((await sql`SELECT id FROM sessions`).length, 1);
    assert.equal((await bootstrapAdmin(sql, winner.email, true)).status, "already-admin");
    assert.equal((await sql`SELECT id FROM moderation_log`).length, 1);
  } finally {
    await sql.end();
    await control.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await control.end();
  }
});

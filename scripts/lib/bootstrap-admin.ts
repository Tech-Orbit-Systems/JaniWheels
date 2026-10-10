import type { Sql } from "postgres";

export class BootstrapInputError extends Error {}

export async function bootstrapAdmin(sql: Sql, email: string, apply: boolean) {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new BootstrapInputError("Provide a valid existing account email.");
  return sql.begin(async (tx) => {
    // Serialize first-admin decisions, including ordinary account changes.
    await tx`LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE`;
    const accounts = await tx`SELECT id,email_verified_at,is_banned,is_admin FROM users WHERE lower(email)=${normalized} FOR UPDATE`;
    if (accounts.length !== 1) throw new BootstrapInputError("A unique account was not found. Register and verify the account first.");
    const account = accounts[0];
    if (account.is_banned) throw new BootstrapInputError("A banned account cannot become administrator.");
    if (!account.email_verified_at) throw new BootstrapInputError("Verify this account's email before provisioning administrator access.");
    if (account.is_admin) return { status: "already-admin" as const, userId: Number(account.id) };
    const [existing] = await tx`SELECT id FROM users WHERE is_admin=true LIMIT 1`;
    if (existing) throw new BootstrapInputError("An administrator already exists. Use an approved administrator-management process.");
    if (!apply) return { status: "dry-run" as const, userId: Number(account.id) };
    await tx`UPDATE users SET is_admin=true,updated_at=NOW() WHERE id=${account.id}`;
    await tx`INSERT INTO moderation_log (user_id,action,reason,is_automated,metadata)
      VALUES (${account.id},'admin_bootstrap','Initial administrator provisioned through the operator CLI',false,${tx.json({ source: "bootstrap-admin-cli" })})`;
    // Existing browser sessions must sign in again before using the new role.
    await tx`DELETE FROM sessions WHERE user_id=${account.id}`;
    return { status: "created" as const, userId: Number(account.id) };
  });
}

import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env" });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is missing from .env.");
}

const hostname = new URL(databaseUrl).hostname;
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
if (!localHosts.has(hostname)) {
  throw new Error(
    "Refusing to repair a non-local database. Use reviewed migrations in staging and production.",
  );
}

const sql = postgres(databaseUrl, { max: 1 });

try {
  const before = await sql<{ authAccounts: string | null }[]>`
    select to_regclass('public.auth_accounts')::text as "authAccounts"
  `;

  if (before[0]?.authAccounts) {
    console.log("  [DB] Google authentication schema already present");
  } else {
    console.log("  [DB] Repairing missing local Google authentication schema...");

    await sql.begin(async (tx) => {
      await tx`alter table "users" alter column "phone" drop not null`;
      await tx`
        alter table "users"
        add column if not exists "email_verified_at" timestamp with time zone
      `;
      await tx`
        update "users"
        set "email_verified_at" = coalesce("created_at", now())
        where "email" is not null and "email_verified_at" is null
      `;

      await tx`
        create table if not exists "auth_accounts" (
          "id" bigserial primary key,
          "user_id" integer not null references "users"("id") on delete cascade,
          "provider" text not null,
          "provider_subject" text not null,
          "provider_email" text,
          "created_at" timestamp with time zone default now() not null,
          "updated_at" timestamp with time zone default now() not null
        )
      `;
      await tx`
        create unique index if not exists "auth_accounts_provider_subject_uq"
        on "auth_accounts" ("provider", "provider_subject")
      `;
      await tx`
        create unique index if not exists "auth_accounts_user_provider_uq"
        on "auth_accounts" ("user_id", "provider")
      `;
      await tx`
        create index if not exists "auth_accounts_user_idx"
        on "auth_accounts" ("user_id")
      `;

      await tx`
        create table if not exists "email_verification_tokens" (
          "id" bigserial primary key,
          "user_id" integer not null references "users"("id") on delete cascade,
          "email" text not null,
          "token_hash" text not null,
          "expires_at" timestamp with time zone not null,
          "used_at" timestamp with time zone,
          "requested_ip" text,
          "created_at" timestamp with time zone default now() not null
        )
      `;
      await tx`
        create unique index if not exists "email_verification_tokens_hash_uq"
        on "email_verification_tokens" ("token_hash")
      `;
      await tx`
        create index if not exists "email_verification_tokens_user_created_idx"
        on "email_verification_tokens" ("user_id", "created_at")
      `;
      await tx`
        create index if not exists "email_verification_tokens_expiry_idx"
        on "email_verification_tokens" ("expires_at")
      `;
    });

    const after = await sql<{ authAccounts: string | null }[]>`
      select to_regclass('public.auth_accounts')::text as "authAccounts"
    `;
    if (!after[0]?.authAccounts) {
      throw new Error("Local Google authentication schema repair did not complete.");
    }

    console.log("  [DB] Google authentication schema repaired");
  }
} finally {
  await sql.end();
}

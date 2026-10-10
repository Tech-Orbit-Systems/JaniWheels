import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * A single pooled client, cached across hot reloads in dev.
 *
 * Without the globalThis cache, Next's dev server opens a new pool on every
 * file change and exhausts Postgres connections within a few minutes.
 */

const globalForDb = globalThis as unknown as {
  pgClient: ReturnType<typeof postgres> | undefined;
  retentionClient: ReturnType<typeof postgres> | undefined;
};

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and fill it in.",
    );
  }
  return postgres(url, {
    max: process.env.NODE_ENV === "production" ? 20 : 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

const client = globalForDb.pgClient ?? createClient();
// Drizzle replaces date/JSON codecs on its client. Raw transactional retention
// queries need the native codecs, so use a small independent cached pool.
export const sqlClient = globalForDb.retentionClient ?? postgres(process.env.DATABASE_URL!, {
  max: 3, idle_timeout: 20, connect_timeout: 10,
});
if (process.env.NODE_ENV !== "production") globalForDb.retentionClient = sqlClient;
if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, { schema });
export { schema };
export type Db = typeof db;

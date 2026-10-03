import { integer, pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

export const rateLimitBuckets = pgTable(
  "rate_limit_buckets",
  {
    key: text("key").primaryKey(),
    hits: integer("hits").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("rate_limit_buckets_expires_idx").on(table.expiresAt)],
);

CREATE TABLE IF NOT EXISTS "rate_limit_buckets" (
  "key" text PRIMARY KEY NOT NULL,
  "hits" integer DEFAULT 0 NOT NULL,
  "expires_at" timestamp with time zone NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rate_limit_buckets_expires_idx" ON "rate_limit_buckets" USING btree ("expires_at");

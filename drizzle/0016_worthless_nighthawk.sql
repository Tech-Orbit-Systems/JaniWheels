CREATE TABLE "retention_holds" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"resource" text NOT NULL,
	"resource_id" integer NOT NULL,
	"reason" text NOT NULL,
	"responsible" text NOT NULL,
	"actor_user_id" integer,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"released_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "retention_media_deletions" (
	"storage_key" text PRIMARY KEY NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retention_monthly_totals" (
	"month" text NOT NULL,
	"type" text NOT NULL,
	"events" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retention_receipts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"resource" text NOT NULL,
	"resource_id" integer NOT NULL,
	"action" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retention_runs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"operator" text NOT NULL,
	"mode" text NOT NULL,
	"cutoff" timestamp with time zone NOT NULL,
	"summary" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "recovery_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "anonymized_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "closure_state" jsonb;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "retention_inactive_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "redacted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "inspections" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "inspections" ADD COLUMN "redacted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sell_assistance_requests" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sell_assistance_requests" ADD COLUMN "redacted_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "retention_holds_resource_idx" ON "retention_holds" USING btree ("resource","resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX "retention_monthly_totals_uq" ON "retention_monthly_totals" USING btree ("month","type");--> statement-breakpoint
CREATE INDEX "retention_receipts_time_idx" ON "retention_receipts" USING btree ("occurred_at");
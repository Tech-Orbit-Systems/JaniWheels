ALTER TABLE "saved_search_notifications" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "saved_search_notifications" ADD COLUMN "first_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "saved_search_notifications" ADD COLUMN "next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "saved_search_notifications" ADD COLUMN "suppressed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "saved_search_notifications" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "saved_search_notifications" ADD COLUMN "payload" jsonb;

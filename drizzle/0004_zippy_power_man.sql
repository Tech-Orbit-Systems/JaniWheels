CREATE TABLE "pending_uploads" (
	"storage_key" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"bytes" integer NOT NULL,
	"listing_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "pending_uploads" ADD CONSTRAINT "pending_uploads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_uploads" ADD CONSTRAINT "pending_uploads_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pending_uploads_user_created_idx" ON "pending_uploads" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "pending_uploads_cleanup_idx" ON "pending_uploads" USING btree ("claimed_at","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_images_storage_key_uq" ON "listing_images" USING btree ("storage_key");
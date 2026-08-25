CREATE TABLE "saved_search_notifications" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"saved_search_id" integer NOT NULL,
	"listing_id" integer NOT NULL,
	"recipient_email" text NOT NULL,
	"delivered" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "saved_search_notifications" ADD CONSTRAINT "saved_search_notifications_saved_search_id_saved_searches_id_fk" FOREIGN KEY ("saved_search_id") REFERENCES "public"."saved_searches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_search_notifications" ADD CONSTRAINT "saved_search_notifications_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "saved_search_notifications_match_uq" ON "saved_search_notifications" USING btree ("saved_search_id","listing_id");--> statement-breakpoint
CREATE INDEX "saved_search_notifications_delivery_idx" ON "saved_search_notifications" USING btree ("delivered","created_at");
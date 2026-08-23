CREATE TABLE "listing_custom_features" (
	"id" serial PRIMARY KEY NOT NULL,
	"listing_id" integer NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "custom_area_name" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "custom_make_name" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "custom_model_name" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "custom_variant_name" text;--> statement-breakpoint
ALTER TABLE "part_details" ADD COLUMN "custom_category_name" text;--> statement-breakpoint
ALTER TABLE "part_details" ADD COLUMN "custom_compatible_make_name" text;--> statement-breakpoint
ALTER TABLE "part_details" ADD COLUMN "custom_compatible_model_name" text;--> statement-breakpoint
ALTER TABLE "listing_custom_features" ADD CONSTRAINT "listing_custom_features_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listing_custom_features_listing_idx" ON "listing_custom_features" USING btree ("listing_id");
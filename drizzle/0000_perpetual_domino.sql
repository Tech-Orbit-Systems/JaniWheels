CREATE TYPE "public"."assembly" AS ENUM('local', 'imported');--> statement-breakpoint
CREATE TYPE "public"."body_type" AS ENUM('hatchback', 'sedan', 'suv', 'crossover', 'van', 'pickup', 'mini_van', 'wagon', 'coupe', 'convertible', 'truck', 'mpv', 'micro_van', 'high_roof');--> statement-breakpoint
CREATE TYPE "public"."fuel" AS ENUM('petrol', 'diesel', 'hybrid', 'electric', 'cng', 'lpg');--> statement-breakpoint
CREATE TYPE "public"."inspection_status" AS ENUM('requested', 'scheduled', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."lead_type" AS ENUM('phone_reveal', 'whatsapp_click', 'message_sent', 'dealer_profile_click', 'finance_enquiry', 'inspection_enquiry');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('draft', 'pending_review', 'active', 'sold', 'expired', 'rejected', 'removed');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'paid', 'failed', 'refunded', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."part_condition" AS ENUM('new', 'used', 'refurbished');--> statement-breakpoint
CREATE TYPE "public"."report_reason" AS ENUM('sold', 'fraud', 'wrong_price', 'wrong_category', 'duplicate', 'offensive', 'spam', 'other');--> statement-breakpoint
CREATE TYPE "public"."seller_type" AS ENUM('individual', 'dealer');--> statement-breakpoint
CREATE TYPE "public"."transmission" AS ENUM('manual', 'automatic');--> statement-breakpoint
CREATE TYPE "public"."vertical" AS ENUM('car', 'bike', 'part');--> statement-breakpoint
CREATE TABLE "areas" (
	"id" serial PRIMARY KEY NOT NULL,
	"city_id" integer NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cities" (
	"id" serial PRIMARY KEY NOT NULL,
	"province_id" integer NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"popularity" integer DEFAULT 0 NOT NULL,
	"is_major" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provinces" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"is_indexable" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "features" (
	"id" serial PRIMARY KEY NOT NULL,
	"vertical" "vertical" NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"group_name" text NOT NULL,
	"is_indexable_facet" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generations" (
	"id" serial PRIMARY KEY NOT NULL,
	"model_id" integer NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"year_from" smallint NOT NULL,
	"year_to" smallint
);
--> statement-breakpoint
CREATE TABLE "makes" (
	"id" serial PRIMARY KEY NOT NULL,
	"vertical" "vertical" NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"logo_url" text,
	"country_of_origin" text,
	"popularity" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "models" (
	"id" serial PRIMARY KEY NOT NULL,
	"make_id" integer NOT NULL,
	"vertical" "vertical" NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"full_slug" text NOT NULL,
	"body_type" "body_type",
	"popularity" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "part_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"parent_id" integer,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"full_slug" text NOT NULL,
	"popularity" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "variants" (
	"id" serial PRIMARY KEY NOT NULL,
	"model_id" integer NOT NULL,
	"generation_id" integer,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"engine_cc" integer,
	"transmission" "transmission",
	"fuel" "fuel",
	"body_type" "body_type",
	"year_from" smallint,
	"year_to" smallint,
	"launch_price_pkr" integer,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dealers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"business_name" text NOT NULL,
	"slug" text NOT NULL,
	"city_id" integer NOT NULL,
	"address" text,
	"logo_url" text,
	"about" text,
	"landline" text,
	"whatsapp" text,
	"verified_at" timestamp with time zone,
	"active_listing_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"consumed_at" timestamp with time zone,
	"request_ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" text,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"phone_verified_at" timestamp with time zone,
	"name" text,
	"email" text,
	"avatar_url" text,
	"type" "seller_type" DEFAULT 'individual' NOT NULL,
	"trust_score" smallint DEFAULT 50 NOT NULL,
	"is_banned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "bike_details" (
	"listing_id" integer PRIMARY KEY NOT NULL,
	"registered_city_id" integer,
	"is_unregistered" boolean DEFAULT false NOT NULL,
	"color" text,
	"has_documents" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "car_details" (
	"listing_id" integer PRIMARY KEY NOT NULL,
	"registered_city_id" integer,
	"is_unregistered" boolean DEFAULT false NOT NULL,
	"color" text,
	"auction_grade" text,
	"has_auction_sheet" boolean DEFAULT false NOT NULL,
	"last_token_paid_year" smallint,
	"owner_count" smallint
);
--> statement-breakpoint
CREATE TABLE "listing_features" (
	"listing_id" integer NOT NULL,
	"feature_id" integer NOT NULL,
	CONSTRAINT "listing_features_listing_id_feature_id_pk" PRIMARY KEY("listing_id","feature_id")
);
--> statement-breakpoint
CREATE TABLE "listing_images" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"listing_id" integer NOT NULL,
	"storage_key" text NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"width" integer,
	"height" integer,
	"blurhash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" serial PRIMARY KEY NOT NULL,
	"vertical" "vertical" NOT NULL,
	"seller_id" integer NOT NULL,
	"dealer_id" integer,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"price_pkr" integer NOT NULL,
	"is_negotiable" boolean DEFAULT false NOT NULL,
	"city_id" integer NOT NULL,
	"area_id" integer,
	"status" "listing_status" DEFAULT 'draft' NOT NULL,
	"make_id" integer,
	"model_id" integer,
	"variant_id" integer,
	"year" smallint,
	"mileage_km" integer,
	"transmission" "transmission",
	"fuel" "fuel",
	"body_type" "body_type",
	"engine_cc" integer,
	"assembly" "assembly",
	"featured_until" timestamp with time zone,
	"bumped_at" timestamp with time zone,
	"inspection_score" smallint,
	"is_certified" boolean DEFAULT false NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"lead_count" integer DEFAULT 0 NOT NULL,
	"photo_count" smallint DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"sold_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "part_details" (
	"listing_id" integer PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"condition" "part_condition" NOT NULL,
	"brand" text,
	"part_number" text,
	"compatible_make_id" integer,
	"compatible_model_id" integer,
	"warranty_months" smallint,
	"stock_qty" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"listing_id" integer NOT NULL,
	"user_id" integer,
	"anon_id" text,
	"type" "lead_type" NOT NULL,
	"source" text,
	"referrer" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_views_daily" (
	"listing_id" integer NOT NULL,
	"day" timestamp with time zone NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"unique_views" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"vertical" "vertical" NOT NULL,
	"make_id" integer,
	"model_id" integer,
	"variant_id" integer,
	"year" smallint,
	"city_id" integer,
	"p25_pkr" integer NOT NULL,
	"p50_pkr" integer NOT NULL,
	"p75_pkr" integer NOT NULL,
	"sample_size" integer NOT NULL,
	"median_days_to_sell" smallint,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_listings" (
	"user_id" integer NOT NULL,
	"listing_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_searches" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text,
	"vertical" "vertical" NOT NULL,
	"filters" jsonb NOT NULL,
	"alert_frequency" text DEFAULT 'daily' NOT NULL,
	"last_notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ad_packages" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"vertical" "vertical",
	"price_pkr" integer NOT NULL,
	"duration_days" smallint DEFAULT 30 NOT NULL,
	"featured_days" smallint DEFAULT 0 NOT NULL,
	"bump_count" smallint DEFAULT 0 NOT NULL,
	"photo_limit" smallint DEFAULT 10 NOT NULL,
	"homepage_slot" boolean DEFAULT false NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dealer_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"monthly_price_pkr" integer NOT NULL,
	"listing_quota" integer NOT NULL,
	"featured_quota" smallint DEFAULT 0 NOT NULL,
	"bulk_upload" boolean DEFAULT false NOT NULL,
	"branded_storefront" boolean DEFAULT false NOT NULL,
	"lead_analytics" boolean DEFAULT false NOT NULL,
	"priority_support" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dealer_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"dealer_id" integer NOT NULL,
	"plan_id" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"auto_renew" boolean DEFAULT false NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"user_id" integer NOT NULL,
	"listing_id" integer,
	"ad_package_id" integer,
	"dealer_plan_id" integer,
	"amount_pkr" integer NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"gateway" text,
	"gateway_ref" text,
	"gateway_payload" jsonb,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inspections" (
	"id" serial PRIMARY KEY NOT NULL,
	"listing_id" integer,
	"requested_by_user_id" integer NOT NULL,
	"package_slug" text NOT NULL,
	"price_pkr" integer NOT NULL,
	"city_id" integer NOT NULL,
	"address" text,
	"contact_phone" text NOT NULL,
	"status" "inspection_status" DEFAULT 'requested' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"inspector_id" integer,
	"overall_score" smallint,
	"section_scores" jsonb,
	"report_pdf_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_reports" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"listing_id" integer NOT NULL,
	"reporter_user_id" integer,
	"reporter_anon_id" text,
	"reason" "report_reason" NOT NULL,
	"comment" text,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_by_user_id" integer,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderation_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"listing_id" integer,
	"user_id" integer,
	"moderator_id" integer,
	"action" text NOT NULL,
	"reason" text,
	"is_automated" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "areas" ADD CONSTRAINT "areas_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cities" ADD CONSTRAINT "cities_province_id_provinces_id_fk" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generations" ADD CONSTRAINT "generations_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "models" ADD CONSTRAINT "models_make_id_makes_id_fk" FOREIGN KEY ("make_id") REFERENCES "public"."makes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_generation_id_generations_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."generations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealers" ADD CONSTRAINT "dealers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealers" ADD CONSTRAINT "dealers_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bike_details" ADD CONSTRAINT "bike_details_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bike_details" ADD CONSTRAINT "bike_details_registered_city_id_cities_id_fk" FOREIGN KEY ("registered_city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_details" ADD CONSTRAINT "car_details_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_details" ADD CONSTRAINT "car_details_registered_city_id_cities_id_fk" FOREIGN KEY ("registered_city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_features" ADD CONSTRAINT "listing_features_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_features" ADD CONSTRAINT "listing_features_feature_id_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_images" ADD CONSTRAINT "listing_images_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_make_id_makes_id_fk" FOREIGN KEY ("make_id") REFERENCES "public"."makes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_details" ADD CONSTRAINT "part_details_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_details" ADD CONSTRAINT "part_details_category_id_part_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."part_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_details" ADD CONSTRAINT "part_details_compatible_make_id_makes_id_fk" FOREIGN KEY ("compatible_make_id") REFERENCES "public"."makes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_details" ADD CONSTRAINT "part_details_compatible_model_id_models_id_fk" FOREIGN KEY ("compatible_model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_events" ADD CONSTRAINT "lead_events_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_events" ADD CONSTRAINT "lead_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_views_daily" ADD CONSTRAINT "listing_views_daily_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_snapshots" ADD CONSTRAINT "price_snapshots_make_id_makes_id_fk" FOREIGN KEY ("make_id") REFERENCES "public"."makes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_snapshots" ADD CONSTRAINT "price_snapshots_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_snapshots" ADD CONSTRAINT "price_snapshots_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_snapshots" ADD CONSTRAINT "price_snapshots_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_listings" ADD CONSTRAINT "saved_listings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_listings" ADD CONSTRAINT "saved_listings_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealer_subscriptions" ADD CONSTRAINT "dealer_subscriptions_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealer_subscriptions" ADD CONSTRAINT "dealer_subscriptions_plan_id_dealer_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."dealer_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_ad_package_id_ad_packages_id_fk" FOREIGN KEY ("ad_package_id") REFERENCES "public"."ad_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_dealer_plan_id_dealer_plans_id_fk" FOREIGN KEY ("dealer_plan_id") REFERENCES "public"."dealer_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_inspector_id_users_id_fk" FOREIGN KEY ("inspector_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_reports" ADD CONSTRAINT "listing_reports_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_reports" ADD CONSTRAINT "listing_reports_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_reports" ADD CONSTRAINT "listing_reports_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_log" ADD CONSTRAINT "moderation_log_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_log" ADD CONSTRAINT "moderation_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_log" ADD CONSTRAINT "moderation_log_moderator_id_users_id_fk" FOREIGN KEY ("moderator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "areas_city_slug_uq" ON "areas" USING btree ("city_id","slug");--> statement-breakpoint
CREATE INDEX "areas_city_idx" ON "areas" USING btree ("city_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cities_slug_uq" ON "cities" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "cities_province_idx" ON "cities" USING btree ("province_id");--> statement-breakpoint
CREATE INDEX "cities_popularity_idx" ON "cities" USING btree ("popularity");--> statement-breakpoint
CREATE UNIQUE INDEX "provinces_slug_uq" ON "provinces" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "features_vertical_slug_uq" ON "features" USING btree ("vertical","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "generations_model_slug_uq" ON "generations" USING btree ("model_id","slug");--> statement-breakpoint
CREATE INDEX "generations_model_idx" ON "generations" USING btree ("model_id");--> statement-breakpoint
CREATE UNIQUE INDEX "makes_vertical_slug_uq" ON "makes" USING btree ("vertical","slug");--> statement-breakpoint
CREATE INDEX "makes_popularity_idx" ON "makes" USING btree ("popularity");--> statement-breakpoint
CREATE UNIQUE INDEX "models_full_slug_uq" ON "models" USING btree ("full_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "models_make_slug_uq" ON "models" USING btree ("make_id","slug");--> statement-breakpoint
CREATE INDEX "models_make_idx" ON "models" USING btree ("make_id");--> statement-breakpoint
CREATE INDEX "models_popularity_idx" ON "models" USING btree ("popularity");--> statement-breakpoint
CREATE UNIQUE INDEX "part_categories_full_slug_uq" ON "part_categories" USING btree ("full_slug");--> statement-breakpoint
CREATE INDEX "part_categories_parent_idx" ON "part_categories" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "variants_model_slug_uq" ON "variants" USING btree ("model_id","slug");--> statement-breakpoint
CREATE INDEX "variants_model_idx" ON "variants" USING btree ("model_id");--> statement-breakpoint
CREATE INDEX "variants_generation_idx" ON "variants" USING btree ("generation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dealers_slug_uq" ON "dealers" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "dealers_user_uq" ON "dealers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "dealers_city_idx" ON "dealers" USING btree ("city_id");--> statement-breakpoint
CREATE INDEX "otp_phone_idx" ON "otp_codes" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "otp_expires_idx" ON "otp_codes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_uq" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "users_type_idx" ON "users" USING btree ("type");--> statement-breakpoint
CREATE INDEX "listing_features_feature_idx" ON "listing_features" USING btree ("feature_id");--> statement-breakpoint
CREATE INDEX "listing_images_listing_idx" ON "listing_images" USING btree ("listing_id","position");--> statement-breakpoint
CREATE INDEX "listings_search_idx" ON "listings" USING btree ("vertical","status","make_id","model_id","bumped_at");--> statement-breakpoint
CREATE INDEX "listings_city_idx" ON "listings" USING btree ("vertical","status","city_id","bumped_at");--> statement-breakpoint
CREATE INDEX "listings_price_idx" ON "listings" USING btree ("vertical","status","price_pkr");--> statement-breakpoint
CREATE INDEX "listings_year_idx" ON "listings" USING btree ("vertical","status","year");--> statement-breakpoint
CREATE INDEX "listings_featured_idx" ON "listings" USING btree ("featured_until");--> statement-breakpoint
CREATE INDEX "listings_seller_idx" ON "listings" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "listings_dealer_idx" ON "listings" USING btree ("dealer_id");--> statement-breakpoint
CREATE INDEX "listings_expiry_idx" ON "listings" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "listings_pricing_idx" ON "listings" USING btree ("variant_id","year","city_id");--> statement-breakpoint
CREATE INDEX "part_details_category_idx" ON "part_details" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "part_details_compat_idx" ON "part_details" USING btree ("compatible_make_id","compatible_model_id");--> statement-breakpoint
CREATE INDEX "lead_events_listing_idx" ON "lead_events" USING btree ("listing_id","created_at");--> statement-breakpoint
CREATE INDEX "lead_events_created_idx" ON "lead_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "lead_events_type_idx" ON "lead_events" USING btree ("type","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_views_daily_uq" ON "listing_views_daily" USING btree ("listing_id","day");--> statement-breakpoint
CREATE UNIQUE INDEX "price_snapshots_key_uq" ON "price_snapshots" USING btree ("variant_id","year","city_id","computed_at");--> statement-breakpoint
CREATE INDEX "price_snapshots_lookup_idx" ON "price_snapshots" USING btree ("variant_id","year","city_id");--> statement-breakpoint
CREATE INDEX "price_snapshots_model_idx" ON "price_snapshots" USING btree ("model_id","year");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_listings_uq" ON "saved_listings" USING btree ("user_id","listing_id");--> statement-breakpoint
CREATE INDEX "saved_listings_user_idx" ON "saved_listings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "saved_searches_user_idx" ON "saved_searches" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ad_packages_slug_uq" ON "ad_packages" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "dealer_plans_slug_uq" ON "dealer_plans" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "dealer_subs_dealer_idx" ON "dealer_subscriptions" USING btree ("dealer_id");--> statement-breakpoint
CREATE INDEX "dealer_subs_active_idx" ON "dealer_subscriptions" USING btree ("ends_at");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_reference_uq" ON "orders" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "orders_user_idx" ON "orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "inspections_listing_idx" ON "inspections" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "inspections_status_idx" ON "inspections" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX "inspections_city_idx" ON "inspections" USING btree ("city_id");--> statement-breakpoint
CREATE INDEX "listing_reports_listing_idx" ON "listing_reports" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "listing_reports_status_idx" ON "listing_reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "moderation_log_listing_idx" ON "moderation_log" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "moderation_log_created_idx" ON "moderation_log" USING btree ("created_at");
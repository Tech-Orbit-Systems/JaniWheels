CREATE TABLE "sell_assistance_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"actor_user_id" integer NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"internal_note" text,
	"customer_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sell_assistance_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"requested_by_user_id" integer NOT NULL,
	"listing_id" integer,
	"city_id" integer NOT NULL,
	"make_id" integer NOT NULL,
	"model_id" integer NOT NULL,
	"year" integer NOT NULL,
	"mileage_km" integer NOT NULL,
	"registration_city" text NOT NULL,
	"ownership_status" text NOT NULL,
	"vehicle_condition" text NOT NULL,
	"expected_price_pkr" integer,
	"selling_timeline" text NOT NULL,
	"address" text NOT NULL,
	"contact_phone" text NOT NULL,
	"preferred_contact" text DEFAULT 'phone' NOT NULL,
	"best_contact_time" text,
	"seller_notes" text,
	"status" text DEFAULT 'requested' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sell_assistance_events" ADD CONSTRAINT "sell_assistance_events_request_id_sell_assistance_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."sell_assistance_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sell_assistance_events" ADD CONSTRAINT "sell_assistance_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sell_assistance_requests" ADD CONSTRAINT "sell_assistance_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sell_assistance_requests" ADD CONSTRAINT "sell_assistance_requests_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sell_assistance_requests" ADD CONSTRAINT "sell_assistance_requests_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sell_assistance_requests" ADD CONSTRAINT "sell_assistance_requests_make_id_makes_id_fk" FOREIGN KEY ("make_id") REFERENCES "public"."makes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sell_assistance_requests" ADD CONSTRAINT "sell_assistance_requests_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sell_assistance_events_request_idx" ON "sell_assistance_events" USING btree ("request_id","created_at");--> statement-breakpoint
CREATE INDEX "sell_assistance_events_actor_idx" ON "sell_assistance_events" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "sell_assistance_user_idx" ON "sell_assistance_requests" USING btree ("requested_by_user_id","created_at");--> statement-breakpoint
CREATE INDEX "sell_assistance_status_idx" ON "sell_assistance_requests" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "sell_assistance_city_idx" ON "sell_assistance_requests" USING btree ("city_id","created_at");
ALTER TABLE "bike_details" ADD COLUMN "bike_type" text DEFAULT 'motorcycle' NOT NULL;--> statement-breakpoint
ALTER TABLE "bike_details" ADD COLUMN "condition" text DEFAULT 'used' NOT NULL;--> statement-breakpoint
ALTER TABLE "bike_details" ADD COLUMN "ignition_type" text;--> statement-breakpoint
ALTER TABLE "bike_details" ADD COLUMN "engine_type" text;--> statement-breakpoint
ALTER TABLE "bike_details" ADD COLUMN "number_of_gears" smallint;--> statement-breakpoint
ALTER TABLE "bike_details" ADD COLUMN "motor_power_watts" integer;--> statement-breakpoint
ALTER TABLE "bike_details" ADD COLUMN "battery_type" text;--> statement-breakpoint
ALTER TABLE "bike_details" ADD COLUMN "battery_voltage" smallint;--> statement-breakpoint
ALTER TABLE "bike_details" ADD COLUMN "battery_capacity_ah" integer;--> statement-breakpoint
ALTER TABLE "bike_details" ADD COLUMN "claimed_range_km" integer;--> statement-breakpoint
ALTER TABLE "bike_details" ADD COLUMN "top_speed_kph" integer;--> statement-breakpoint
ALTER TABLE "bike_details" ADD COLUMN "charging_time_minutes" integer;--> statement-breakpoint
ALTER TABLE "bike_details" ADD COLUMN "battery_health_percent" smallint;--> statement-breakpoint
ALTER TABLE "bike_details" ADD COLUMN "battery_removable" boolean;--> statement-breakpoint
ALTER TABLE "bike_details" ADD COLUMN "charger_included" boolean;--> statement-breakpoint
ALTER TABLE "bike_details" ADD COLUMN "battery_warranty_months" smallint;--> statement-breakpoint
ALTER TABLE "part_details" ADD COLUMN "oem_number" text;--> statement-breakpoint
ALTER TABLE "part_details" ADD COLUMN "part_origin" text;--> statement-breakpoint
ALTER TABLE "part_details" ADD COLUMN "price_unit" text DEFAULT 'piece' NOT NULL;--> statement-breakpoint
ALTER TABLE "part_details" ADD COLUMN "compatible_year_from" smallint;--> statement-breakpoint
ALTER TABLE "part_details" ADD COLUMN "compatible_year_to" smallint;--> statement-breakpoint
ALTER TABLE "part_details" ADD COLUMN "position" text;--> statement-breakpoint
ALTER TABLE "part_details" ADD COLUMN "delivery_option" text DEFAULT 'pickup' NOT NULL;
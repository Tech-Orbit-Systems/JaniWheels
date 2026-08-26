CREATE TABLE "inspection_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"inspection_id" integer NOT NULL,
	"actor_user_id" integer NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"internal_note" text,
	"customer_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inspections" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "inspection_events" ADD CONSTRAINT "inspection_events_inspection_id_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_events" ADD CONSTRAINT "inspection_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inspection_events_inspection_idx" ON "inspection_events" USING btree ("inspection_id","created_at");--> statement-breakpoint
CREATE INDEX "inspection_events_actor_idx" ON "inspection_events" USING btree ("actor_user_id","created_at");
CREATE TABLE "event_time_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"occurrence_date" date NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_time_overrides" ADD CONSTRAINT "event_time_overrides_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_time_override_once" ON "event_time_overrides" USING btree ("event_id","occurrence_date");

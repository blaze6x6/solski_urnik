CREATE TABLE "event_reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"minutes_before" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminder_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"reminder_id" integer NOT NULL,
	"occurrence_date" date NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "location" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "start_time" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "end_time" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "scope_id" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "recurrence" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "recurrence_until" date;--> statement-breakpoint
ALTER TABLE "event_reminders" ADD CONSTRAINT "event_reminders_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_log" ADD CONSTRAINT "reminder_log_reminder_id_event_reminders_id_fk" FOREIGN KEY ("reminder_id") REFERENCES "public"."event_reminders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reminder_once" ON "reminder_log" USING btree ("reminder_id","occurrence_date");
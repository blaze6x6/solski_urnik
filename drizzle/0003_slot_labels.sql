ALTER TABLE "time_slots" ADD COLUMN "label" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "time_slots" ADD COLUMN "kind" text DEFAULT 'lesson' NOT NULL;--> statement-breakpoint
ALTER TABLE "time_slots" ADD COLUMN "show_in_timetable" boolean DEFAULT true NOT NULL;
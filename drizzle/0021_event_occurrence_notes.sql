CREATE TABLE "event_occurrence_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"occurrence_date" date NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_occurrence_notes" ADD CONSTRAINT "event_occurrence_notes_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_occ_note_once" ON "event_occurrence_notes" USING btree ("event_id","occurrence_date");

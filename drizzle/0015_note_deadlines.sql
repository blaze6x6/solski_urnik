ALTER TABLE "notes" ADD COLUMN "due_date" date;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "remind_days" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "done" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "done_at" timestamp;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "reminder_sent_for" date;

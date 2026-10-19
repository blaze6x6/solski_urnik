ALTER TABLE "users" ADD COLUMN "child_id" integer;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "created_by" integer;--> statement-breakpoint
ALTER TABLE "grades" ADD COLUMN "delete_requested_at" timestamp;

CREATE TABLE "user_emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"email" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"notify_new_events" boolean DEFAULT true NOT NULL,
	"notify_event_changes" boolean DEFAULT true NOT NULL,
	"notify_reminders" boolean DEFAULT true NOT NULL,
	"notify_digest" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_emails" ADD CONSTRAINT "user_emails_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_unique" ON "user_emails" USING btree ("user_id","email");
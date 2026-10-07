ALTER TABLE "bus_routes" ADD COLUMN "arrival_time" text;--> statement-breakpoint
ALTER TABLE "bus_routes" ALTER COLUMN "line" SET DEFAULT '';--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"scope_id" integer NOT NULL,
	"actor_id" integer,
	"actor_name" text DEFAULT '' NOT NULL,
	"kind" text NOT NULL,
	"action" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_states" (
	"user_id" integer NOT NULL,
	"notification_id" integer NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"read_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_states_user_id_notification_id_pk" PRIMARY KEY("user_id","notification_id")
);
--> statement-breakpoint
ALTER TABLE "notification_states" ADD CONSTRAINT "notification_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_states" ADD CONSTRAINT "notification_states_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_scope_idx" ON "notifications" USING btree ("scope_id","id");
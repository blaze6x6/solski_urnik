ALTER TABLE "users" ADD COLUMN "is_superadmin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "users" SET "is_superadmin" = true WHERE "id" = (SELECT min("id") FROM "users");--> statement-breakpoint
UPDATE "events" SET "scope_id" = "children"."user_id" FROM "children" WHERE "events"."child_id" = "children"."id" AND "events"."scope_id" IS NULL;--> statement-breakpoint
UPDATE "events" SET "scope_id" = (SELECT coalesce("household_id", "id") FROM "users" ORDER BY "id" LIMIT 1) WHERE "scope_id" IS NULL AND "child_id" IS NULL;
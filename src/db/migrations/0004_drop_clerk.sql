ALTER TABLE "users" DROP CONSTRAINT "users_clerk_id_unique";--> statement-breakpoint
DROP INDEX "users_clerk_id_idx";--> statement-breakpoint
DROP INDEX "users_email_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "clerk_id";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "image_url";
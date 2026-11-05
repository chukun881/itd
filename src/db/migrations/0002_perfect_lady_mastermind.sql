DROP TABLE "credit_transactions" CASCADE;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "credits";--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "tier";--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "provider";--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "provider_webhook_delivery_id";--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "input_image_key";--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "processed_model_key";--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "processed_model_mobile_key";--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "thumbnail_key";--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "raw_file_size";--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "processed_file_size";--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "poly_count";--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "retry_count";--> statement-breakpoint
DROP TYPE "public"."credit_transaction_type";--> statement-breakpoint
DROP TYPE "public"."provider";--> statement-breakpoint
DROP TYPE "public"."tier";
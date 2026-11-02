CREATE TYPE "public"."credit_transaction_type" AS ENUM('purchase', 'generation', 'refund', 'bonus');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('pending', 'uploading', 'queued', 'submitted', 'processing', 'compressing', 'completed', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."provider" AS ENUM('tripo', 'rodin', 'meshy');--> statement-breakpoint
CREATE TYPE "public"."tier" AS ENUM('standard', 'premium');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"image_url" text,
	"credits" integer DEFAULT 3 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "job_status" DEFAULT 'pending' NOT NULL,
	"tier" "tier" NOT NULL,
	"provider" "provider" NOT NULL,
	"provider_task_id" text,
	"provider_webhook_delivery_id" text,
	"input_image_key" text,
	"raw_model_key" text,
	"processed_model_key" text,
	"processed_model_mobile_key" text,
	"thumbnail_key" text,
	"raw_file_size" integer,
	"processed_file_size" integer,
	"poly_count" integer,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"provider_meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"type" "credit_transaction_type" NOT NULL,
	"job_id" uuid,
	"stripe_payment_intent_id" text,
	"stripe_checkout_session_id" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_clerk_id_idx" ON "users" USING btree ("clerk_id");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "jobs_user_id_idx" ON "jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "jobs_provider_task_id_idx" ON "jobs" USING btree ("provider_task_id");--> statement-breakpoint
CREATE INDEX "jobs_created_at_idx" ON "jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "credit_tx_user_id_idx" ON "credit_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "credit_tx_type_idx" ON "credit_transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "credit_tx_job_id_idx" ON "credit_transactions" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "credit_tx_created_at_idx" ON "credit_transactions" USING btree ("created_at");
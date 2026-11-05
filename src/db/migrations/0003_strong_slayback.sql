ALTER TABLE "jobs" ADD COLUMN "name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "width_mm" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "depth_mm" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "height_mm" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "seat_height_mm" integer;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "arm_height_mm" integer;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "remove_background" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "input_keys" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "cutout_keys" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "output_keys" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "metrics" jsonb;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "cost_usd" real;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "step_requested" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "feedback_rating" integer;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "feedback_hours_saved" real;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "feedback_comment" text;
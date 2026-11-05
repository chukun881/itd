ALTER TABLE "jobs" ALTER COLUMN "width_mm" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "width_mm" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "depth_mm" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "depth_mm" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "height_mm" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "height_mm" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "seat_height_mm";--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "arm_height_mm";--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "step_requested";
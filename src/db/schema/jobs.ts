import { pgTable, uuid, text, timestamp, jsonb, index, integer, real, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { jobStatusEnum } from './enums';
import type { JobView } from '@/lib/shared';

export const jobs = pgTable('jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  status: jobStatusEnum('status').notNull().default('pending'),

  // What the user asked for
  name: text('name').notNull().default(''),
  note: text('note'),
  widthMm: integer('width_mm').notNull().default(0),
  depthMm: integer('depth_mm').notNull().default(0),
  heightMm: integer('height_mm').notNull().default(0),
  seatHeightMm: integer('seat_height_mm'),
  armHeightMm: integer('arm_height_mm'),
  removeBackground: boolean('remove_background').notNull().default(false),

  // R2 keys: { front, back?, left?, right? }
  inputKeys: jsonb('input_keys').$type<Partial<Record<JobView, string>>>().notNull().default({}),
  cutoutKeys: jsonb('cutout_keys').$type<Partial<Record<JobView, string>>>().notNull().default({}),
  outputKeys: jsonb('output_keys').$type<JobOutputKeys>().notNull().default({}),

  // Pipeline numbers (stretch, symmetry, measurement checks, faces)
  metrics: jsonb('metrics').$type<JobMetrics>(),
  costUsd: real('cost_usd'),

  // STEP is produced by hand on request
  stepRequested: boolean('step_requested').notNull().default(false),

  // Designer feedback
  feedbackRating: integer('feedback_rating'),
  feedbackHoursSaved: real('feedback_hours_saved'),
  feedbackComment: text('feedback_comment'),

  // fal queue request id
  providerTaskId: text('provider_task_id'),
  rawModelKey: text('raw_model_key'),
  errorMessage: text('error_message'),
  providerMeta: jsonb('provider_meta'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => [
  index('jobs_user_id_idx').on(table.userId),
  index('jobs_status_idx').on(table.status),
  index('jobs_provider_task_id_idx').on(table.providerTaskId),
  index('jobs_created_at_idx').on(table.createdAt),
]);

export const jobsRelations = relations(jobs, ({ one }) => ({
  user: one(users, {
    fields: [jobs.userId],
    references: [users.id],
  }),
}));

export { JOB_VIEWS, type JobView } from '@/lib/shared';

export interface JobOutputKeys {
  glb?: string;
  stl?: string;
  obj?: string;
  preview?: string;
  step?: string;
}

export interface JobMetrics {
  faces: number;
  symmetryApplied: boolean;
  symmetryError: number;
  stretchWidthPct: number;
  stretchDepthPct: number;
  seatEstimateMm?: number;
  seatErrorMm?: number;
  armEstimateMm?: number;
  armErrorMm?: number;
  processingSeconds: number;
}

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;

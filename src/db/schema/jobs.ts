import { pgTable, uuid, text, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { jobStatusEnum, tierEnum, providerEnum } from './enums';

export const jobs = pgTable('jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),

  // Job configuration
  status: jobStatusEnum('status').notNull().default('pending'),
  tier: tierEnum('tier').notNull(),
  provider: providerEnum('provider').notNull(),

  // Provider tracking
  providerTaskId: text('provider_task_id'),
  providerWebhookDeliveryId: text('provider_webhook_delivery_id'), // Idempotency key

  // Storage URLs
  inputImageKey: text('input_image_key'),            // R2 key: raw-uploads/{job_id}.jpg
  rawModelKey: text('raw_model_key'),                // R2 key: raw-models/{job_id}-raw.glb
  processedModelKey: text('processed_model_key'),    // R2 key: processed-models/{job_id}.glb
  processedModelMobileKey: text('processed_model_mobile_key'), // R2 key: processed-models/{job_id}/mobile.glb
  thumbnailKey: text('thumbnail_key'),               // R2 key: thumbnails/{job_id}.webp

  // Model metadata
  rawFileSize: integer('raw_file_size'),             // bytes
  processedFileSize: integer('processed_file_size'), // bytes
  polyCount: integer('poly_count'),                  // triangle count

  // Error handling
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').notNull().default(0),

  // Provider raw response
  providerMeta: jsonb('provider_meta'),

  // Timestamps
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

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;

import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { jobStatusEnum } from './enums';

export const jobs = pgTable('jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  status: jobStatusEnum('status').notNull().default('pending'),

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

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;

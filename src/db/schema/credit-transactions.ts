import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { jobs } from './jobs';
import { creditTransactionTypeEnum } from './enums';

export const creditTransactions = pgTable('credit_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  amount: integer('amount').notNull(),                  // +10, -1, etc.
  type: creditTransactionTypeEnum('type').notNull(),
  jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'set null' }),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  stripeCheckoutSessionId: text('stripe_checkout_session_id'),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('credit_tx_user_id_idx').on(table.userId),
  index('credit_tx_type_idx').on(table.type),
  index('credit_tx_job_id_idx').on(table.jobId),
  index('credit_tx_created_at_idx').on(table.createdAt),
]);

export const creditTransactionsRelations = relations(creditTransactions, ({ one }) => ({
  user: one(users, {
    fields: [creditTransactions.userId],
    references: [users.id],
  }),
  job: one(jobs, {
    fields: [creditTransactions.jobId],
    references: [jobs.id],
  }),
}));

export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type NewCreditTransaction = typeof creditTransactions.$inferInsert;

import { pgTable, uuid, text, timestamp, integer, uniqueIndex } from 'drizzle-orm/pg-core';

// Users are created by the admin with scripts/create-user.mjs; there is no sign-up.
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull(), // stored lower-case
  name: text('name'),
  passwordHash: text('password_hash').notNull(),
  // Bump to sign the user out of every device
  sessionVersion: integer('session_version').notNull().default(1),
  // Brute-force guard: 5 wrong passwords lock the account for 15 minutes
  failedLogins: integer('failed_logins').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('users_email_unique').on(table.email),
]);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

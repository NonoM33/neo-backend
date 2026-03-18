import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const calendarSyncTokens = pgTable('calendar_sync_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  token: varchar('token', { length: 128 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastAccessedAt: timestamp('last_accessed_at'),
});

export type CalendarSyncToken = typeof calendarSyncTokens.$inferSelect;
export type NewCalendarSyncToken = typeof calendarSyncTokens.$inferInsert;

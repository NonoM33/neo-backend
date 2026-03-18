import { pgTable, uuid, varchar, text, timestamp, pgEnum, boolean, jsonb } from 'drizzle-orm/pg-core';
import { clients } from './projects';
import { users } from './users';

export const smsStatusEnum = pgEnum('sms_status', [
  'pending',
  'sent',
  'delivered',
  'failed',
]);

export const smsLog = pgTable('sms_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  phoneNumber: varchar('phone_number', { length: 20 }).notNull(),
  message: text('message').notNull(),
  status: smsStatusEnum('status').notNull().default('pending'),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
  sentById: uuid('sent_by_id').references(() => users.id, { onDelete: 'set null' }),
  context: varchar('context', { length: 100 }),
  contextId: uuid('context_id'),
  apiResponse: jsonb('api_response'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type SmsLog = typeof smsLog.$inferSelect;
export type NewSmsLog = typeof smsLog.$inferInsert;

import { pgTable, uuid, varchar, text, timestamp, pgEnum, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users';

export const syncOperationEnum = pgEnum('sync_operation', ['create', 'update', 'delete']);

export const syncLog = pgTable('sync_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tableName: varchar('table_name', { length: 100 }).notNull(),
  recordId: uuid('record_id').notNull(),
  operation: syncOperationEnum('operation').notNull(),
  data: jsonb('data'),
  clientTimestamp: timestamp('client_timestamp').notNull(),
  serverTimestamp: timestamp('server_timestamp').defaultNow().notNull(),
  deviceId: varchar('device_id', { length: 100 }),
});

export type SyncLog = typeof syncLog.$inferSelect;
export type NewSyncLog = typeof syncLog.$inferInsert;

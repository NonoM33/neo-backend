import { pgTable, uuid, varchar, text, timestamp, pgEnum, boolean } from 'drizzle-orm/pg-core';
import { rooms } from './rooms';
import { products } from './products';

export const deviceStatusEnum = pgEnum('device_status', [
  'planifie',
  'installe',
  'configure',
  'operationnel',
  'en_panne',
]);

export const devices = pgTable('devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomId: uuid('room_id')
    .notNull()
    .references(() => rooms.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  serialNumber: varchar('serial_number', { length: 100 }),
  macAddress: varchar('mac_address', { length: 17 }),
  ipAddress: varchar('ip_address', { length: 45 }),
  status: deviceStatusEnum('status').notNull().default('planifie'),
  location: varchar('location', { length: 255 }),
  notes: text('notes'),
  isOnline: boolean('is_online').default(false),
  lastSeenAt: timestamp('last_seen_at'),
  installedAt: timestamp('installed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  decimal,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { clients } from './projects';
import { appointments } from './appointments';

// Tracking session status enum
export const trackingStatusEnum = pgEnum('tracking_status', [
  'pending',
  'active',
  'arrived',
  'expired',
  'cancelled',
]);

// Tracking sessions table
export const trackingSessions = pgTable(
  'tracking_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    token: varchar('token', { length: 128 }).notNull().unique(),
    appointmentId: uuid('appointment_id')
      .notNull()
      .references(() => appointments.id, { onDelete: 'cascade' }),
    auditorId: uuid('auditor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    clientId: uuid('client_id')
      .references(() => clients.id, { onDelete: 'set null' }),
    status: trackingStatusEnum('status').notNull().default('pending'),
    // Destination
    destinationAddress: text('destination_address'),
    destinationLat: decimal('destination_lat', { precision: 10, scale: 7 }),
    destinationLng: decimal('destination_lng', { precision: 10, scale: 7 }),
    // Current position
    currentLat: decimal('current_lat', { precision: 10, scale: 7 }),
    currentLng: decimal('current_lng', { precision: 10, scale: 7 }),
    currentLocationUpdatedAt: timestamp('current_location_updated_at'),
    // ETA
    etaMinutes: integer('eta_minutes'),
    etaUpdatedAt: timestamp('eta_updated_at'),
    // SMS
    smsSentAt: timestamp('sms_sent_at'),
    smsPhoneNumber: varchar('sms_phone_number', { length: 20 }),
    // Timestamps
    startedAt: timestamp('started_at'),
    arrivedAt: timestamp('arrived_at'),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('tracking_sessions_token_idx').on(table.token),
    index('tracking_sessions_appointment_id_idx').on(table.appointmentId),
    index('tracking_sessions_auditor_id_idx').on(table.auditorId),
    index('tracking_sessions_status_idx').on(table.status),
  ]
);

// Location history table
export const trackingLocationHistory = pgTable(
  'tracking_location_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => trackingSessions.id, { onDelete: 'cascade' }),
    lat: decimal('lat', { precision: 10, scale: 7 }).notNull(),
    lng: decimal('lng', { precision: 10, scale: 7 }).notNull(),
    accuracy: decimal('accuracy', { precision: 6, scale: 2 }),
    heading: decimal('heading', { precision: 5, scale: 2 }),
    speed: decimal('speed', { precision: 6, scale: 2 }),
    recordedAt: timestamp('recorded_at').defaultNow().notNull(),
  },
  (table) => [
    index('tracking_location_history_session_id_idx').on(table.sessionId),
    index('tracking_location_history_recorded_at_idx').on(table.recordedAt),
  ]
);

// Type exports
export type TrackingSession = typeof trackingSessions.$inferSelect;
export type NewTrackingSession = typeof trackingSessions.$inferInsert;
export type TrackingLocationHistory = typeof trackingLocationHistory.$inferSelect;
export type NewTrackingLocationHistory = typeof trackingLocationHistory.$inferInsert;

// Status labels
export const trackingStatusLabels: Record<TrackingSession['status'], string> = {
  pending: 'En attente',
  active: 'En route',
  arrived: 'Arrivé',
  expired: 'Expiré',
  cancelled: 'Annulé',
};

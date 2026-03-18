import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  integer,
  boolean,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { leads } from './crm';
import { clients, projects } from './projects';

// Appointment type enum
export const appointmentTypeEnum = pgEnum('appointment_type', [
  'visite_technique',
  'audit',
  'rdv_commercial',
  'installation',
  'sav',
  'reunion_interne',
  'autre',
]);

// Appointment status enum
export const appointmentStatusEnum = pgEnum('appointment_status', [
  'propose',
  'confirme',
  'en_cours',
  'termine',
  'annule',
  'no_show',
]);

// Recurrence frequency enum
export const recurrenceFrequencyEnum = pgEnum('recurrence_frequency', [
  'quotidien',
  'hebdomadaire',
  'bi_hebdomadaire',
  'mensuel',
]);

// Day of week enum
export const dayOfWeekEnum = pgEnum('day_of_week', [
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
  'dimanche',
]);

// Participant role enum
export const participantRoleEnum = pgEnum('participant_role', [
  'organisateur',
  'participant',
  'optionnel',
]);

// Participant status enum
export const participantStatusEnum = pgEnum('participant_status', [
  'en_attente',
  'accepte',
  'refuse',
]);

// Location type enum
export const locationTypeEnum = pgEnum('location_type', [
  'sur_site',
  'bureau',
  'visio',
  'telephone',
]);

// Recurrence rules table
export const recurrenceRules = pgTable('recurrence_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  frequency: recurrenceFrequencyEnum('frequency').notNull(),
  interval: integer('interval').notNull().default(1),
  daysOfWeek: jsonb('days_of_week'), // string[] of dayOfWeek values
  endDate: timestamp('end_date'),
  maxOccurrences: integer('max_occurrences'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Appointments table
export const appointments = pgTable(
  'appointments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: varchar('title', { length: 255 }),
    type: appointmentTypeEnum('type').notNull(),
    status: appointmentStatusEnum('status').notNull().default('propose'),
    scheduledAt: timestamp('scheduled_at').notNull(),
    endAt: timestamp('end_at').notNull(),
    duration: integer('duration').notNull(), // in minutes
    location: text('location'),
    locationType: locationTypeEnum('location_type').default('sur_site'),
    organizerId: uuid('organizer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    recurrenceRuleId: uuid('recurrence_rule_id').references(() => recurrenceRules.id, {
      onDelete: 'set null',
    }),
    recurrenceParentId: uuid('recurrence_parent_id'),
    notes: text('notes'),
    outcome: text('outcome'),
    cancellationReason: text('cancellation_reason'),
    publicToken: varchar('public_token', { length: 64 }),
    reminder2hSent: boolean('reminder_2h_sent').default(false),
    reminder30mSent: boolean('reminder_30m_sent').default(false),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('appointments_organizer_scheduled_idx').on(table.organizerId, table.scheduledAt),
    index('appointments_scheduled_at_idx').on(table.scheduledAt),
    index('appointments_status_idx').on(table.status),
    index('appointments_lead_id_idx').on(table.leadId),
    index('appointments_client_id_idx').on(table.clientId),
    index('appointments_project_id_idx').on(table.projectId),
    index('appointments_recurrence_parent_idx').on(table.recurrenceParentId),
  ]
);

// Appointment participants table
export const appointmentParticipants = pgTable('appointment_participants', {
  id: uuid('id').primaryKey().defaultRandom(),
  appointmentId: uuid('appointment_id')
    .notNull()
    .references(() => appointments.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: participantRoleEnum('role').notNull().default('participant'),
  status: participantStatusEnum('status').notNull().default('en_attente'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Availability slots table (weekly recurring)
export const availabilitySlots = pgTable('availability_slots', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  dayOfWeek: dayOfWeekEnum('day_of_week').notNull(),
  startTime: varchar('start_time', { length: 5 }).notNull(), // HH:MM
  endTime: varchar('end_time', { length: 5 }).notNull(), // HH:MM
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Availability overrides table
export const availabilityOverrides = pgTable('availability_overrides', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  date: timestamp('date').notNull(),
  isAvailable: boolean('is_available').notNull(),
  startTime: varchar('start_time', { length: 5 }), // HH:MM
  endTime: varchar('end_time', { length: 5 }), // HH:MM
  reason: text('reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Appointment type configs table
export const appointmentTypeConfigs = pgTable('appointment_type_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: appointmentTypeEnum('type').notNull().unique(),
  label: varchar('label', { length: 100 }).notNull(),
  defaultDuration: integer('default_duration').notNull(),
  color: varchar('color', { length: 7 }).notNull(),
  icon: varchar('icon', { length: 50 }).notNull(),
  allowedRoles: jsonb('allowed_roles'), // string[]
  requiresClient: boolean('requires_client').default(false),
  requiresLocation: boolean('requires_location').default(true),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Type exports
export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;
export type AppointmentParticipant = typeof appointmentParticipants.$inferSelect;
export type NewAppointmentParticipant = typeof appointmentParticipants.$inferInsert;
export type RecurrenceRule = typeof recurrenceRules.$inferSelect;
export type NewRecurrenceRule = typeof recurrenceRules.$inferInsert;
export type AvailabilitySlot = typeof availabilitySlots.$inferSelect;
export type NewAvailabilitySlot = typeof availabilitySlots.$inferInsert;
export type AvailabilityOverride = typeof availabilityOverrides.$inferSelect;
export type NewAvailabilityOverride = typeof availabilityOverrides.$inferInsert;
export type AppointmentTypeConfig = typeof appointmentTypeConfigs.$inferSelect;
export type NewAppointmentTypeConfig = typeof appointmentTypeConfigs.$inferInsert;

// Label maps
export const appointmentTypeLabels: Record<Appointment['type'], string> = {
  visite_technique: 'Visite technique',
  audit: 'Audit',
  rdv_commercial: 'RDV Commercial',
  installation: 'Installation',
  sav: 'SAV',
  reunion_interne: 'Réunion interne',
  autre: 'Autre',
};

export const appointmentStatusLabels: Record<Appointment['status'], string> = {
  propose: 'Proposé',
  confirme: 'Confirmé',
  en_cours: 'En cours',
  termine: 'Terminé',
  annule: 'Annulé',
  no_show: 'No-show',
};

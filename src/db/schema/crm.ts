import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  decimal,
  integer,
  boolean,
  jsonb,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { clients, projects } from './projects';

// Lead status enum - pipeline stages
export const leadStatusEnum = pgEnum('lead_status', [
  'prospect',
  'qualifie',
  'proposition',
  'negociation',
  'gagne',
  'perdu',
]);

// Lead source enum
export const leadSourceEnum = pgEnum('lead_source', [
  'site_web',
  'recommandation',
  'salon',
  'publicite',
  'appel_entrant',
  'partenaire',
  'autre',
]);

// Activity type enum
export const activityTypeEnum = pgEnum('activity_type', [
  'appel',
  'email',
  'reunion',
  'visite',
  'note',
  'tache',
]);

// Activity status enum
export const activityStatusEnum = pgEnum('activity_status', [
  'planifie',
  'termine',
  'annule',
]);

// Leads table - sales pipeline
export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Optional link to existing client
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
  // Contact info (can be independent of client)
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 20 }),
  company: varchar('company', { length: 255 }),
  // Lead details
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: leadStatusEnum('status').notNull().default('prospect'),
  source: leadSourceEnum('source').notNull().default('autre'),
  // Financial
  estimatedValue: decimal('estimated_value', { precision: 12, scale: 2 }),
  probability: integer('probability').default(0), // 0-100%
  // Assignment
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  // Location (for potential project)
  address: text('address'),
  city: varchar('city', { length: 100 }),
  postalCode: varchar('postal_code', { length: 10 }),
  surface: decimal('surface', { precision: 10, scale: 2 }),
  // Conversion tracking
  convertedProjectId: uuid('converted_project_id').references(() => projects.id, {
    onDelete: 'set null',
  }),
  convertedAt: timestamp('converted_at'),
  lostReason: text('lost_reason'),
  // Dates
  expectedCloseDate: timestamp('expected_close_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Activities table - interactions and tasks
export const activities = pgTable('activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Polymorphic links (at least one should be set)
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  // Activity details
  type: activityTypeEnum('type').notNull(),
  subject: varchar('subject', { length: 255 }).notNull(),
  description: text('description'),
  status: activityStatusEnum('status').notNull().default('planifie'),
  // Scheduling
  scheduledAt: timestamp('scheduled_at'),
  completedAt: timestamp('completed_at'),
  duration: integer('duration'), // in minutes
  // Reminders
  reminderAt: timestamp('reminder_at'),
  reminderSent: boolean('reminder_sent').default(false),
  // Assignment
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  // Additional data
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Sales objectives table
export const salesObjectives = pgTable('sales_objectives', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  year: integer('year').notNull(),
  month: integer('month'), // 1-12, null for annual
  quarter: integer('quarter'), // 1-4, null for monthly/annual
  // Targets
  revenueTarget: decimal('revenue_target', { precision: 12, scale: 2 }),
  leadsTarget: integer('leads_target'),
  conversionsTarget: integer('conversions_target'),
  activitiesTarget: integer('activities_target'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Lead stage history for tracking progression
export const leadStageHistory = pgTable('lead_stage_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id')
    .notNull()
    .references(() => leads.id, { onDelete: 'cascade' }),
  fromStatus: leadStatusEnum('from_status'),
  toStatus: leadStatusEnum('to_status').notNull(),
  changedBy: uuid('changed_by')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  notes: text('notes'),
  changedAt: timestamp('changed_at').defaultNow().notNull(),
});

// Type exports
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
export type SalesObjective = typeof salesObjectives.$inferSelect;
export type NewSalesObjective = typeof salesObjectives.$inferInsert;
export type LeadStageHistory = typeof leadStageHistory.$inferSelect;
export type NewLeadStageHistory = typeof leadStageHistory.$inferInsert;

// Status and source labels for display
export const leadStatusLabels: Record<Lead['status'], string> = {
  prospect: 'Prospect',
  qualifie: 'Qualifié',
  proposition: 'Proposition',
  negociation: 'Négociation',
  gagne: 'Gagné',
  perdu: 'Perdu',
};

export const leadSourceLabels: Record<Lead['source'], string> = {
  site_web: 'Site web',
  recommandation: 'Recommandation',
  salon: 'Salon',
  publicite: 'Publicité',
  appel_entrant: 'Appel entrant',
  partenaire: 'Partenaire',
  autre: 'Autre',
};

export const activityTypeLabels: Record<Activity['type'], string> = {
  appel: 'Appel',
  email: 'Email',
  reunion: 'Réunion',
  visite: 'Visite',
  note: 'Note',
  tache: 'Tâche',
};

export const activityStatusLabels: Record<Activity['status'], string> = {
  planifie: 'Planifié',
  termine: 'Terminé',
  annule: 'Annulé',
};

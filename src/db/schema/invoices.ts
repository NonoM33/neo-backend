import { pgTable, uuid, varchar, text, timestamp, decimal, integer, pgEnum } from 'drizzle-orm/pg-core';
import { orders } from './orders';
import { projects } from './projects';
import { users } from './users';

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'brouillon',  // En cours de création
  'envoyee',    // Envoyée au client
  'payee',      // Payée
  'annulee',    // Annulée
]);

export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  number: varchar('number', { length: 50 }).notNull().unique(), // FAC-YYYY-####
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  status: invoiceStatusEnum('status').notNull().default('brouillon'),

  // Totaux
  totalHT: decimal('total_ht', { precision: 12, scale: 2 }).notNull().default('0'),
  totalTVA: decimal('total_tva', { precision: 12, scale: 2 }).notNull().default('0'),
  totalTTC: decimal('total_ttc', { precision: 12, scale: 2 }).notNull().default('0'),

  // Paiement
  dueDate: timestamp('due_date'),
  paymentTerms: varchar('payment_terms', { length: 100 }).default('30 jours'),
  paymentMethod: varchar('payment_method', { length: 50 }),

  // Mentions légales
  legalMentions: text('legal_mentions'),

  // PDF
  pdfUrl: text('pdf_url'),

  // Notes
  notes: text('notes'),

  // Dates importantes
  sentAt: timestamp('sent_at'),
  paidAt: timestamp('paid_at'),
  cancelledAt: timestamp('cancelled_at'),

  // Audit
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const invoiceLines = pgTable('invoice_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),

  // Infos ligne
  reference: varchar('reference', { length: 100 }),
  description: varchar('description', { length: 500 }).notNull(),
  quantity: integer('quantity').notNull().default(1),

  // Prix
  unitPriceHT: decimal('unit_price_ht', { precision: 10, scale: 2 }).notNull(),
  tvaRate: decimal('tva_rate', { precision: 5, scale: 2 }).notNull().default('20.00'),
  totalHT: decimal('total_ht', { precision: 12, scale: 2 }).notNull(),

  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceLine = typeof invoiceLines.$inferSelect;
export type NewInvoiceLine = typeof invoiceLines.$inferInsert;

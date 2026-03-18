import { pgTable, uuid, varchar, text, timestamp, decimal, integer, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { products } from './products';

export const quoteStatusEnum = pgEnum('quote_status', [
  'brouillon',
  'envoye',
  'accepte',
  'refuse',
  'expire',
]);

export const quotes = pgTable('quotes', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  number: varchar('number', { length: 50 }).notNull().unique(),
  status: quoteStatusEnum('status').notNull().default('brouillon'),
  validUntil: timestamp('valid_until'),
  totalHT: decimal('total_ht', { precision: 12, scale: 2 }).notNull().default('0'),
  totalTVA: decimal('total_tva', { precision: 12, scale: 2 }).notNull().default('0'),
  totalTTC: decimal('total_ttc', { precision: 12, scale: 2 }).notNull().default('0'),
  discount: decimal('discount', { precision: 5, scale: 2 }).default('0'),
  totalCostHT: decimal('total_cost_ht', { precision: 12, scale: 2 }).default('0'),
  totalMarginHT: decimal('total_margin_ht', { precision: 12, scale: 2 }).default('0'),
  marginPercent: decimal('margin_percent', { precision: 5, scale: 2 }).default('0'),
  notes: text('notes'),
  pdfUrl: text('pdf_url'),
  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const quoteLines = pgTable('quote_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  quoteId: uuid('quote_id')
    .notNull()
    .references(() => quotes.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
  description: varchar('description', { length: 500 }).notNull(),
  quantity: integer('quantity').notNull().default(1),
  unitPriceHT: decimal('unit_price_ht', { precision: 10, scale: 2 }).notNull(),
  tvaRate: decimal('tva_rate', { precision: 5, scale: 2 }).notNull().default('20.00'),
  totalHT: decimal('total_ht', { precision: 12, scale: 2 }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  unitCostHT: decimal('unit_cost_ht', { precision: 10, scale: 2 }),
  // Client possède déjà ce produit (pas besoin de le fournir)
  clientOwned: boolean('client_owned').notNull().default(false),
  // Photo preuve que le client possède le produit
  clientOwnedPhotoUrl: text('client_owned_photo_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type Quote = typeof quotes.$inferSelect;
export type NewQuote = typeof quotes.$inferInsert;
export type QuoteLine = typeof quoteLines.$inferSelect;
export type NewQuoteLine = typeof quoteLines.$inferInsert;

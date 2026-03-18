import { pgTable, uuid, varchar, text, timestamp, decimal, integer, pgEnum } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { products } from './products';
import { quotes } from './quotes';
import { users } from './users';

export const orderStatusEnum = pgEnum('order_status', [
  'en_attente',      // Commande créée, en attente de confirmation
  'confirmee',       // Commande confirmée, stock réservé
  'payee',           // Paiement reçu
  'en_preparation',  // En cours de préparation
  'expediee',        // Expédiée, tracking disponible
  'livree',          // Livrée au client
  'annulee',         // Commande annulée
]);

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  number: varchar('number', { length: 50 }).notNull().unique(), // CMD-YYYY-####
  quoteId: uuid('quote_id').references(() => quotes.id, { onDelete: 'set null' }),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  status: orderStatusEnum('status').notNull().default('en_attente'),

  // Totaux
  totalHT: decimal('total_ht', { precision: 12, scale: 2 }).notNull().default('0'),
  totalTVA: decimal('total_tva', { precision: 12, scale: 2 }).notNull().default('0'),
  totalTTC: decimal('total_ttc', { precision: 12, scale: 2 }).notNull().default('0'),
  discount: decimal('discount', { precision: 5, scale: 2 }).default('0'),

  // Coûts et marges (usage interne)
  totalCostHT: decimal('total_cost_ht', { precision: 12, scale: 2 }).default('0'),
  totalMarginHT: decimal('total_margin_ht', { precision: 12, scale: 2 }).default('0'),

  // Adresse de livraison
  shippingAddress: text('shipping_address'),
  shippingCity: varchar('shipping_city', { length: 100 }),
  shippingPostalCode: varchar('shipping_postal_code', { length: 20 }),
  shippingNotes: text('shipping_notes'),

  // Suivi livraison
  carrier: varchar('carrier', { length: 100 }),
  trackingNumber: varchar('tracking_number', { length: 100 }),

  // Notes
  notes: text('notes'),
  internalNotes: text('internal_notes'),

  // Dates importantes
  confirmedAt: timestamp('confirmed_at'),
  paidAt: timestamp('paid_at'),
  shippedAt: timestamp('shipped_at'),
  deliveredAt: timestamp('delivered_at'),
  cancelledAt: timestamp('cancelled_at'),

  // Audit
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const orderLines = pgTable('order_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),

  // Infos ligne (snapshot au moment de la commande)
  reference: varchar('reference', { length: 100 }),
  description: varchar('description', { length: 500 }).notNull(),
  quantity: integer('quantity').notNull().default(1),

  // Prix
  unitPriceHT: decimal('unit_price_ht', { precision: 10, scale: 2 }).notNull(),
  unitCostHT: decimal('unit_cost_ht', { precision: 10, scale: 2 }),
  tvaRate: decimal('tva_rate', { precision: 5, scale: 2 }).notNull().default('20.00'),
  totalHT: decimal('total_ht', { precision: 12, scale: 2 }).notNull(),

  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const orderStatusHistory = pgTable('order_status_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  fromStatus: orderStatusEnum('from_status'),
  toStatus: orderStatusEnum('to_status').notNull(),
  changedBy: uuid('changed_by').references(() => users.id, { onDelete: 'set null' }),
  notes: text('notes'),
  changedAt: timestamp('changed_at').defaultNow().notNull(),
});

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderLine = typeof orderLines.$inferSelect;
export type NewOrderLine = typeof orderLines.$inferInsert;
export type OrderStatusHistory = typeof orderStatusHistory.$inferSelect;
export type NewOrderStatusHistory = typeof orderStatusHistory.$inferInsert;

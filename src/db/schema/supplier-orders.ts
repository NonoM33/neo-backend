import { pgTable, uuid, varchar, text, timestamp, decimal, integer, pgEnum } from 'drizzle-orm/pg-core';
import { suppliers } from './suppliers';
import { products } from './products';
import { users } from './users';

export const supplierOrderStatusEnum = pgEnum('supplier_order_status', [
  'brouillon',   // En cours de création
  'envoyee',     // Envoyée au fournisseur
  'confirmee',   // Confirmée par le fournisseur
  'recue',       // Réceptionnée (totalement)
  'annulee',     // Annulée
]);

export const supplierOrders = pgTable('supplier_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  number: varchar('number', { length: 50 }).notNull().unique(), // CF-YYYY-####
  supplierId: uuid('supplier_id')
    .notNull()
    .references(() => suppliers.id, { onDelete: 'restrict' }),
  status: supplierOrderStatusEnum('status').notNull().default('brouillon'),

  // Totaux
  totalHT: decimal('total_ht', { precision: 12, scale: 2 }).notNull().default('0'),
  totalTVA: decimal('total_tva', { precision: 12, scale: 2 }).notNull().default('0'),
  totalTTC: decimal('total_ttc', { precision: 12, scale: 2 }).notNull().default('0'),

  // Infos fournisseur
  supplierReference: varchar('supplier_reference', { length: 100 }),
  expectedDeliveryDate: timestamp('expected_delivery_date'),

  // Notes
  notes: text('notes'),
  internalNotes: text('internal_notes'),

  // Dates importantes
  sentAt: timestamp('sent_at'),
  confirmedAt: timestamp('confirmed_at'),
  receivedAt: timestamp('received_at'),
  cancelledAt: timestamp('cancelled_at'),

  // Audit
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const supplierOrderLines = pgTable('supplier_order_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  supplierOrderId: uuid('supplier_order_id')
    .notNull()
    .references(() => supplierOrders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'restrict' }),

  // Quantités
  quantityOrdered: integer('quantity_ordered').notNull(),
  quantityReceived: integer('quantity_received').notNull().default(0),

  // Prix d'achat
  unitPriceHT: decimal('unit_price_ht', { precision: 10, scale: 2 }).notNull(),
  totalHT: decimal('total_ht', { precision: 12, scale: 2 }).notNull(),

  // Notes
  notes: text('notes'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type SupplierOrder = typeof supplierOrders.$inferSelect;
export type NewSupplierOrder = typeof supplierOrders.$inferInsert;
export type SupplierOrderLine = typeof supplierOrderLines.$inferSelect;
export type NewSupplierOrderLine = typeof supplierOrderLines.$inferInsert;

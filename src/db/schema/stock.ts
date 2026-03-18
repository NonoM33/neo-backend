import { pgTable, uuid, text, timestamp, integer, pgEnum } from 'drizzle-orm/pg-core';
import { products } from './products';
import { orders } from './orders';
import { users } from './users';

export const stockMovementTypeEnum = pgEnum('stock_movement_type', [
  'entree',       // Entrée de stock (réception fournisseur)
  'sortie',       // Sortie de stock (envoi commande client)
  'reservation',  // Réservation pour commande confirmée
  'liberation',   // Libération de réservation (annulation)
  'correction',   // Correction manuelle de stock
  'retour',       // Retour client ou fournisseur
]);

export const stockMovements = pgTable('stock_movements', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  type: stockMovementTypeEnum('type').notNull(),
  quantity: integer('quantity').notNull(), // Positif pour entrée, négatif pour sortie

  // Snapshot des quantités
  stockBefore: integer('stock_before').notNull(),
  stockAfter: integer('stock_after').notNull(),

  // Références optionnelles
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
  supplierOrderId: uuid('supplier_order_id'), // Référence ajoutée après création supplier-orders

  // Infos
  reason: text('reason'),

  // Audit
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type StockMovement = typeof stockMovements.$inferSelect;
export type NewStockMovement = typeof stockMovements.$inferInsert;

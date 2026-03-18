import { pgTable, uuid, varchar, text, timestamp, decimal, boolean, integer, pgEnum } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { suppliers } from './suppliers';

export const dependencyTypeEnum = pgEnum('dependency_type', [
  'required',   // Obligatoire (ex: ampoule Hue → Bridge Hue)
  'recommended', // Recommandé (ex: variateur avec ampoule)
]);

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  reference: varchar('reference', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }).notNull(),
  brand: varchar('brand', { length: 100 }),
  priceHT: decimal('price_ht', { precision: 10, scale: 2 }).notNull(),
  tvaRate: decimal('tva_rate', { precision: 5, scale: 2 }).notNull().default('20.00'),
  imageUrl: text('image_url'),
  isActive: boolean('is_active').default(true).notNull(),
  stock: integer('stock'),
  stockMin: integer('stock_min'), // Seuil d'alerte de stock bas
  purchasePriceHT: decimal('purchase_price_ht', { precision: 10, scale: 2 }),
  supplierId: uuid('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
  supplierProductUrl: text('supplier_product_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const projectProducts = pgTable('project_products', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'restrict' }),
  quantity: integer('quantity').notNull().default(1),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Dépendances entre produits (ex: ampoule Hue nécessite Bridge Hue)
export const productDependencies = pgTable('product_dependencies', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  requiredProductId: uuid('required_product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  type: dependencyTypeEnum('type').notNull().default('required'),
  description: text('description'), // Ex: "1 bridge pour jusqu'à 50 ampoules"
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProjectProduct = typeof projectProducts.$inferSelect;
export type NewProjectProduct = typeof projectProducts.$inferInsert;
export type ProductDependency = typeof productDependencies.$inferSelect;
export type NewProductDependency = typeof productDependencies.$inferInsert;

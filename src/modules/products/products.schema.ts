import { z } from 'zod';

export const createProductSchema = z.object({
  reference: z.string().min(1, 'Référence requise'),
  name: z.string().min(1, 'Nom requis'),
  description: z.string().optional(),
  category: z.string().min(1, 'Catégorie requise'),
  brand: z.string().optional(),
  priceHT: z.coerce.number().positive('Prix HT doit être positif'),
  tvaRate: z.coerce.number().min(0).max(100).default(20),
  imageUrl: z.string().url().optional(),
  isActive: z.boolean().default(true),
  stock: z.coerce.number().int().min(0).optional(),
  purchasePriceHT: z.coerce.number().min(0).optional(),
  supplierId: z.string().uuid().optional().nullable(),
  supplierProductUrl: z.string().url().optional(),
});

export const updateProductSchema = createProductSchema.partial();

export const productFilterSchema = z.object({
  category: z.string().optional(),
  brand: z.string().optional(),
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
});

// Dépendances produits
export const createDependencySchema = z.object({
  requiredProductId: z.string().uuid('ID produit requis invalide'),
  type: z.enum(['required', 'recommended']).default('required'),
  description: z.string().optional(),
});

export const updateDependencySchema = z.object({
  type: z.enum(['required', 'recommended']).optional(),
  description: z.string().optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductFilter = z.infer<typeof productFilterSchema>;
export type CreateDependencyInput = z.infer<typeof createDependencySchema>;
export type UpdateDependencyInput = z.infer<typeof updateDependencySchema>;

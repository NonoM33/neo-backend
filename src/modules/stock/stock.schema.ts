import { z } from 'zod';

export const stockMovementTypeSchema = z.enum([
  'entree',
  'sortie',
  'reservation',
  'liberation',
  'correction',
  'retour',
]);

export const createStockMovementSchema = z.object({
  productId: z.string().uuid('ID produit requis'),
  type: stockMovementTypeSchema,
  quantity: z.coerce.number().int().refine(val => val !== 0, 'La quantité ne peut pas être zéro'),
  reason: z.string().optional(),
  orderId: z.string().uuid().optional(),
  supplierOrderId: z.string().uuid().optional(),
});

export const stockFilterSchema = z.object({
  productId: z.string().uuid().optional(),
  type: stockMovementTypeSchema.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export const stockAlertFilterSchema = z.object({
  category: z.string().optional(),
  supplierId: z.string().uuid().optional(),
});

export type StockMovementType = z.infer<typeof stockMovementTypeSchema>;
export type CreateStockMovementInput = z.infer<typeof createStockMovementSchema>;
export type StockFilter = z.infer<typeof stockFilterSchema>;
export type StockAlertFilter = z.infer<typeof stockAlertFilterSchema>;

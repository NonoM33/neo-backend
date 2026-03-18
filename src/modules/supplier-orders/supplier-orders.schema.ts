import { z } from 'zod';

export const supplierOrderStatusSchema = z.enum([
  'brouillon',
  'envoyee',
  'confirmee',
  'recue',
  'annulee',
]);

export const supplierOrderLineInputSchema = z.object({
  productId: z.string().uuid('ID produit requis'),
  quantityOrdered: z.coerce.number().int().positive('Quantité doit être positive'),
  unitPriceHT: z.coerce.number().min(0, 'Prix doit être positif'),
  notes: z.string().optional(),
});

export const createSupplierOrderSchema = z.object({
  supplierId: z.string().uuid('ID fournisseur requis'),
  expectedDeliveryDate: z.coerce.date().optional(),
  supplierReference: z.string().optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  lines: z.array(supplierOrderLineInputSchema).min(1, 'Au moins une ligne requise'),
});

export const updateSupplierOrderSchema = z.object({
  expectedDeliveryDate: z.coerce.date().optional(),
  supplierReference: z.string().optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
});

export const changeSupplierOrderStatusSchema = z.object({
  status: supplierOrderStatusSchema,
  notes: z.string().optional(),
});

export const receptionLineInputSchema = z.object({
  lineId: z.string().uuid('ID ligne requis'),
  quantityReceived: z.coerce.number().int().min(0, 'Quantité doit être positive ou nulle'),
});

export const receptionInputSchema = z.object({
  lines: z.array(receptionLineInputSchema).min(1, 'Au moins une ligne requise'),
  notes: z.string().optional(),
});

export const supplierOrderFilterSchema = z.object({
  status: supplierOrderStatusSchema.optional(),
  supplierId: z.string().uuid().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type SupplierOrderStatus = z.infer<typeof supplierOrderStatusSchema>;
export type SupplierOrderLineInput = z.infer<typeof supplierOrderLineInputSchema>;
export type CreateSupplierOrderInput = z.infer<typeof createSupplierOrderSchema>;
export type UpdateSupplierOrderInput = z.infer<typeof updateSupplierOrderSchema>;
export type ChangeSupplierOrderStatusInput = z.infer<typeof changeSupplierOrderStatusSchema>;
export type ReceptionLineInput = z.infer<typeof receptionLineInputSchema>;
export type ReceptionInput = z.infer<typeof receptionInputSchema>;
export type SupplierOrderFilter = z.infer<typeof supplierOrderFilterSchema>;

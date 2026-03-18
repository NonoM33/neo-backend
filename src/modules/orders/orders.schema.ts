import { z } from 'zod';

export const orderStatusSchema = z.enum([
  'en_attente',
  'confirmee',
  'payee',
  'en_preparation',
  'expediee',
  'livree',
  'annulee',
]);

export const orderLineInputSchema = z.object({
  productId: z.string().uuid().optional().nullable(),
  reference: z.string().optional(),
  description: z.string().min(1, 'Description requise'),
  quantity: z.coerce.number().int().positive('Quantité doit être positive'),
  unitPriceHT: z.coerce.number().min(0, 'Prix doit être positif'),
  unitCostHT: z.coerce.number().min(0).optional(),
  tvaRate: z.coerce.number().min(0).max(100).default(20),
});

export const createOrderSchema = z.object({
  projectId: z.string().uuid('ID projet requis'),
  quoteId: z.string().uuid().optional(),
  shippingAddress: z.string().optional(),
  shippingCity: z.string().optional(),
  shippingPostalCode: z.string().optional(),
  shippingNotes: z.string().optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  discount: z.coerce.number().min(0).max(100).default(0),
  lines: z.array(orderLineInputSchema).min(1, 'Au moins une ligne requise'),
});

export const updateOrderSchema = z.object({
  shippingAddress: z.string().optional(),
  shippingCity: z.string().optional(),
  shippingPostalCode: z.string().optional(),
  shippingNotes: z.string().optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  carrier: z.string().optional(),
  trackingNumber: z.string().optional(),
});

export const changeOrderStatusSchema = z.object({
  status: orderStatusSchema,
  notes: z.string().optional(),
});

export const orderFilterSchema = z.object({
  status: orderStatusSchema.optional(),
  projectId: z.string().uuid().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type OrderLineInput = z.infer<typeof orderLineInputSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type ChangeOrderStatusInput = z.infer<typeof changeOrderStatusSchema>;
export type OrderFilter = z.infer<typeof orderFilterSchema>;

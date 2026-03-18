import { z } from 'zod';

export const invoiceStatusSchema = z.enum([
  'brouillon',
  'envoyee',
  'payee',
  'annulee',
]);

export const invoiceLineInputSchema = z.object({
  reference: z.string().optional(),
  description: z.string().min(1, 'Description requise'),
  quantity: z.coerce.number().int().positive('Quantité doit être positive'),
  unitPriceHT: z.coerce.number().min(0, 'Prix doit être positif'),
  tvaRate: z.coerce.number().min(0).max(100).default(20),
});

export const createInvoiceSchema = z.object({
  orderId: z.string().uuid().optional(),
  projectId: z.string().uuid('ID projet requis'),
  dueDate: z.coerce.date().optional(),
  paymentTerms: z.string().optional(),
  legalMentions: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(invoiceLineInputSchema).min(1, 'Au moins une ligne requise'),
});

export const createInvoiceFromOrderSchema = z.object({
  orderId: z.string().uuid('ID commande requis'),
  dueDate: z.coerce.date().optional(),
  paymentTerms: z.string().optional(),
  legalMentions: z.string().optional(),
});

export const updateInvoiceSchema = z.object({
  dueDate: z.coerce.date().optional(),
  paymentTerms: z.string().optional(),
  legalMentions: z.string().optional(),
  notes: z.string().optional(),
  paymentMethod: z.string().optional(),
});

export const changeInvoiceStatusSchema = z.object({
  status: invoiceStatusSchema,
  notes: z.string().optional(),
});

export const invoiceFilterSchema = z.object({
  status: invoiceStatusSchema.optional(),
  projectId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  overdue: z.coerce.boolean().optional(),
});

export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>;
export type InvoiceLineInput = z.infer<typeof invoiceLineInputSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type CreateInvoiceFromOrderInput = z.infer<typeof createInvoiceFromOrderSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type ChangeInvoiceStatusInput = z.infer<typeof changeInvoiceStatusSchema>;
export type InvoiceFilter = z.infer<typeof invoiceFilterSchema>;

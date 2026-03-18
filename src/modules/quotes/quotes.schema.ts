import { z } from 'zod';

export const quoteLineSchema = z.object({
  productId: z.string().uuid().optional(),
  description: z.string().min(1, 'Description requise'),
  quantity: z.coerce.number().int().positive('Quantité doit être positive'),
  unitPriceHT: z.coerce.number().positive('Prix unitaire doit être positif'),
  tvaRate: z.coerce.number().min(0).max(100).default(20),
  clientOwned: z.boolean().default(false),
  clientOwnedPhotoUrl: z.string().url().optional(),
}).refine(
  (data) => !data.clientOwned || data.clientOwnedPhotoUrl,
  { message: 'Photo obligatoire quand le client possède déjà le produit', path: ['clientOwnedPhotoUrl'] }
);

export const createQuoteSchema = z.object({
  validUntil: z.coerce.date().optional(),
  discount: z.coerce.number().min(0).max(100).default(0),
  notes: z.string().optional(),
  lines: z.array(quoteLineSchema).default([]),
});

export const updateQuoteSchema = z.object({
  status: z.enum(['brouillon', 'envoye', 'accepte', 'refuse', 'expire']).optional(),
  validUntil: z.coerce.date().optional(),
  discount: z.coerce.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  lines: z.array(quoteLineSchema).optional(),
});

export const addQuoteLineSchema = quoteLineSchema;

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>;
export type QuoteLineInput = z.infer<typeof quoteLineSchema>;

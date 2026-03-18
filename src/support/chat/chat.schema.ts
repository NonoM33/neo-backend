import { z } from 'zod';

export const createSessionSchema = z.object({
  subject: z.string().max(255).optional(),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(5000),
});

export const updateSessionSchema = z.object({
  status: z.enum(['resolved', 'closed']),
});

export const rateSessionSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
export type RateSessionInput = z.infer<typeof rateSessionSchema>;

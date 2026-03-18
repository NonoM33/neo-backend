import { z } from 'zod';

export const clientLoginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

export const clientRefreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token requis'),
});

export const createClientAccountSchema = z.object({
  clientId: z.string().uuid(),
  email: z.string().email(),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
});

export type ClientLoginInput = z.infer<typeof clientLoginSchema>;
export type ClientRefreshInput = z.infer<typeof clientRefreshSchema>;
export type CreateClientAccountInput = z.infer<typeof createClientAccountSchema>;

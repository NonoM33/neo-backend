import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Mot de passe minimum 6 caractères'),
  firstName: z.string().min(1, 'Prénom requis'),
  lastName: z.string().min(1, 'Nom requis'),
  phone: z.string().optional(),
  role: z.enum(['admin', 'integrateur', 'auditeur']).default('integrateur'),
});

export const updateUserSchema = z.object({
  email: z.string().email('Email invalide').optional(),
  password: z.string().min(6, 'Mot de passe minimum 6 caractères').optional(),
  firstName: z.string().min(1, 'Prénom requis').optional(),
  lastName: z.string().min(1, 'Nom requis').optional(),
  phone: z.string().optional(),
  role: z.enum(['admin', 'integrateur', 'auditeur']).optional(),
});

export const userFilterSchema = z.object({
  role: z.enum(['admin', 'integrateur', 'auditeur']).optional(),
  search: z.string().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserFilter = z.infer<typeof userFilterSchema>;

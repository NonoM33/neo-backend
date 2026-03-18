import { z } from 'zod';

// Client schemas
export const createClientSchema = z.object({
  firstName: z.string().min(1, 'Prénom requis'),
  lastName: z.string().min(1, 'Nom requis'),
  email: z.string().email('Email invalide').optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  notes: z.string().optional(),
});

export const updateClientSchema = createClientSchema.partial();

// Project schemas
export const createProjectSchema = z.object({
  clientId: z.string().uuid('ID client invalide'),
  name: z.string().min(1, 'Nom requis'),
  description: z.string().optional(),
  status: z.enum(['brouillon', 'en_cours', 'termine', 'archive']).default('brouillon'),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  surface: z.coerce.number().positive().optional(),
  roomCount: z.coerce.number().int().positive().optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

export const projectFilterSchema = z.object({
  status: z.enum(['brouillon', 'en_cours', 'termine', 'archive']).optional(),
  clientId: z.string().uuid().optional(),
  search: z.string().optional(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ProjectFilter = z.infer<typeof projectFilterSchema>;

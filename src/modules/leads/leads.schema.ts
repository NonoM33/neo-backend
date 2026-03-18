import { z } from 'zod';

// Lead status values
export const leadStatusValues = [
  'prospect',
  'qualifie',
  'proposition',
  'negociation',
  'gagne',
  'perdu',
] as const;

// Lead source values
export const leadSourceValues = [
  'site_web',
  'recommandation',
  'salon',
  'publicite',
  'appel_entrant',
  'partenaire',
  'autre',
] as const;

// Create lead schema
export const createLeadSchema = z.object({
  clientId: z.string().uuid().optional(),
  firstName: z.string().min(1, 'Prénom requis'),
  lastName: z.string().min(1, 'Nom requis'),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().optional(),
  company: z.string().optional(),
  title: z.string().min(1, 'Titre requis'),
  description: z.string().optional(),
  status: z.enum(leadStatusValues).default('prospect'),
  source: z.enum(leadSourceValues).default('autre'),
  estimatedValue: z.coerce.number().min(0).optional(),
  probability: z.coerce.number().int().min(0).max(100).default(0),
  ownerId: z.string().uuid().optional(), // If not provided, assigned to current user
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  surface: z.coerce.number().min(0).optional(),
  expectedCloseDate: z.coerce.date().optional(),
});

// Update lead schema
export const updateLeadSchema = createLeadSchema.partial();

// Change status schema
export const changeStatusSchema = z.object({
  status: z.enum(leadStatusValues),
  notes: z.string().optional(),
  lostReason: z.string().optional(), // Required when status is 'perdu'
});

// Convert to project schema
export const convertLeadSchema = z.object({
  projectName: z.string().min(1, 'Nom du projet requis').optional(),
  createClient: z.boolean().default(true), // Create client if not linked
});

// Lead filter schema
export const leadFilterSchema = z.object({
  status: z.enum(leadStatusValues).optional(),
  source: z.enum(leadSourceValues).optional(),
  ownerId: z.string().uuid().optional(),
  search: z.string().optional(),
  minValue: z.coerce.number().optional(),
  maxValue: z.coerce.number().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

// Type exports
export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;
export type ConvertLeadInput = z.infer<typeof convertLeadSchema>;
export type LeadFilter = z.infer<typeof leadFilterSchema>;
export type LeadStatus = (typeof leadStatusValues)[number];
export type LeadSource = (typeof leadSourceValues)[number];

import { z } from 'zod';

// Activity type values
export const activityTypeValues = [
  'appel',
  'email',
  'reunion',
  'visite',
  'note',
  'tache',
] as const;

// Activity status values
export const activityStatusValues = ['planifie', 'termine', 'annule'] as const;

// Create activity schema
export const createActivitySchema = z.object({
  leadId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  type: z.enum(activityTypeValues),
  subject: z.string().min(1, 'Sujet requis'),
  description: z.string().optional(),
  status: z.enum(activityStatusValues).default('planifie'),
  scheduledAt: z.coerce.date().optional(),
  duration: z.coerce.number().int().min(0).optional(), // in minutes
  reminderAt: z.coerce.date().optional(),
  ownerId: z.string().uuid().optional(), // If not provided, assigned to current user
  metadata: z.record(z.string(), z.any()).optional(),
}).refine(
  (data) => data.leadId || data.clientId || data.projectId,
  { message: 'Au moins un lien (lead, client ou projet) est requis' }
);

// Update activity schema
export const updateActivitySchema = z.object({
  leadId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  type: z.enum(activityTypeValues).optional(),
  subject: z.string().min(1, 'Sujet requis').optional(),
  description: z.string().optional(),
  status: z.enum(activityStatusValues).optional(),
  scheduledAt: z.coerce.date().optional(),
  duration: z.coerce.number().int().min(0).optional(),
  reminderAt: z.coerce.date().optional(),
  ownerId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// Complete activity schema
export const completeActivitySchema = z.object({
  notes: z.string().optional(),
  duration: z.coerce.number().int().min(0).optional(), // Override duration if needed
});

// Activity filter schema
export const activityFilterSchema = z.object({
  type: z.enum(activityTypeValues).optional(),
  status: z.enum(activityStatusValues).optional(),
  ownerId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  search: z.string().optional(),
});

// Type exports
export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;
export type CompleteActivityInput = z.infer<typeof completeActivitySchema>;
export type ActivityFilter = z.infer<typeof activityFilterSchema>;
export type ActivityType = (typeof activityTypeValues)[number];
export type ActivityStatus = (typeof activityStatusValues)[number];

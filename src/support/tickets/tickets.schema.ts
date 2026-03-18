import { z } from 'zod';

const ticketStatuses = ['nouveau', 'ouvert', 'en_attente_client', 'en_attente_interne', 'escalade', 'resolu', 'ferme'] as const;
const ticketPriorities = ['basse', 'normale', 'haute', 'urgente', 'critique'] as const;
const ticketSources = ['email', 'telephone', 'portail', 'chat_ai', 'backoffice', 'api'] as const;

export const createTicketSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  priority: z.enum(ticketPriorities).default('normale'),
  source: z.enum(ticketSources).default('portail'),
  categoryId: z.string().uuid().optional(),
  clientId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  deviceId: z.string().uuid().optional(),
  roomId: z.string().uuid().optional(),
  assignedToId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  aiDiagnosis: z.string().optional(),
  troubleshootingSteps: z.any().optional(),
  chatSessionId: z.string().uuid().optional(),
});

export const updateTicketSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().min(1).optional(),
  priority: z.enum(ticketPriorities).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  deviceId: z.string().uuid().nullable().optional(),
  roomId: z.string().uuid().nullable().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.any().optional(),
});

export const changeStatusSchema = z.object({
  status: z.enum(ticketStatuses),
  notes: z.string().optional(),
});

export const assignTicketSchema = z.object({
  assignedToId: z.string().uuid().nullable(),
});

export const addCommentSchema = z.object({
  content: z.string().min(1),
  type: z.enum(['public', 'interne']).default('public'),
});

export const clientAddCommentSchema = z.object({
  content: z.string().min(1),
});

export const satisfactionSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

export const ticketFilterSchema = z.object({
  status: z.enum(ticketStatuses).optional(),
  priority: z.enum(ticketPriorities).optional(),
  assignedToId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  slaBreached: z.coerce.boolean().optional(),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

// SLA schemas
export const createSlaSchema = z.object({
  name: z.string().min(1).max(100),
  priority: z.enum(ticketPriorities).optional(),
  categoryId: z.string().uuid().optional(),
  firstResponseMinutes: z.coerce.number().int().positive(),
  resolutionMinutes: z.coerce.number().int().positive(),
  isDefault: z.boolean().default(false),
});

export const updateSlaSchema = createSlaSchema.partial();

// Ticket category schemas
export const createTicketCategorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100),
  description: z.string().optional(),
  parentId: z.string().uuid().optional(),
  sortOrder: z.coerce.number().int().default(0),
});

export const updateTicketCategorySchema = createTicketCategorySchema.partial();

// Canned response schemas
export const createCannedResponseSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  categoryId: z.string().uuid().optional(),
  shortcut: z.string().max(50).optional(),
});

export const updateCannedResponseSchema = createCannedResponseSchema.partial();

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;
export type AddCommentInput = z.infer<typeof addCommentSchema>;
export type TicketFilter = z.infer<typeof ticketFilterSchema>;
export type CreateSlaInput = z.infer<typeof createSlaSchema>;
export type UpdateSlaInput = z.infer<typeof updateSlaSchema>;

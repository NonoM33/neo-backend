import { z } from 'zod';

export const createRoomSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  type: z.enum(['salon', 'cuisine', 'chambre', 'salle_de_bain', 'bureau', 'garage', 'exterieur', 'autre']).default('autre'),
  floor: z.coerce.number().int().default(0),
  notes: z.string().optional(),
});

export const updateRoomSchema = createRoomSchema.partial();

export const createChecklistItemSchema = z.object({
  category: z.string().min(1, 'Catégorie requise'),
  label: z.string().min(1, 'Label requis'),
  checked: z.boolean().default(false),
  notes: z.string().optional(),
});

export const updateChecklistItemSchema = createChecklistItemSchema.partial();

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
export type CreateChecklistItemInput = z.infer<typeof createChecklistItemSchema>;
export type UpdateChecklistItemInput = z.infer<typeof updateChecklistItemSchema>;

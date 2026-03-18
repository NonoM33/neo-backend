import { z } from 'zod';

export const createDeviceSchema = z.object({
  productId: z.string().uuid().optional(),
  name: z.string().min(1, 'Nom requis'),
  serialNumber: z.string().optional(),
  macAddress: z.string().optional(),
  ipAddress: z.string().optional(),
  status: z.enum(['planifie', 'installe', 'configure', 'operationnel', 'en_panne']).default('planifie'),
  location: z.string().optional(),
  notes: z.string().optional(),
});

export const updateDeviceSchema = createDeviceSchema.partial().extend({
  isOnline: z.boolean().optional(),
});

export type CreateDeviceInput = z.infer<typeof createDeviceSchema>;
export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>;

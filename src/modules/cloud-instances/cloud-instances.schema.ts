import { z } from 'zod';

export const createCloudInstanceSchema = z.object({
  clientId: z.string().uuid('ID client invalide'),
  domain: z.string().min(3, 'Domaine requis').optional(),
  memoryLimitMb: z.coerce.number().int().min(256).max(4096).default(512),
  cpuLimit: z.string().default('0.5'),
  haVersion: z.string().default('stable'),
});

export const updateCloudInstanceSchema = z.object({
  memoryLimitMb: z.coerce.number().int().min(256).max(4096).optional(),
  cpuLimit: z.string().optional(),
  domain: z.string().min(3).optional(),
});

export const heartbeatSchema = z.object({
  tenant_id: z.string(),
  status: z.string(),
  version: z.string().optional(),
  entity_count: z.coerce.number().int().default(0),
  automation_count: z.coerce.number().int().default(0),
  uptime_seconds: z.coerce.number().int().default(0),
});

export const instanceFilterSchema = z.object({
  status: z.enum(['provisioning', 'running', 'stopped', 'error', 'destroying']).optional(),
  clientId: z.string().uuid().optional(),
  search: z.string().optional(),
  isOnline: z.enum(['true', 'false']).optional(),
});

export type CreateCloudInstanceInput = z.infer<typeof createCloudInstanceSchema>;
export type UpdateCloudInstanceInput = z.infer<typeof updateCloudInstanceSchema>;
export type HeartbeatInput = z.infer<typeof heartbeatSchema>;
export type InstanceFilter = z.infer<typeof instanceFilterSchema>;

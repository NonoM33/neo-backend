import { z } from 'zod';

export const syncPushSchema = z.object({
  deviceId: z.string().min(1, 'Device ID requis'),
  changes: z.array(
    z.object({
      tableName: z.string(),
      recordId: z.string().uuid(),
      operation: z.enum(['create', 'update', 'delete']),
      data: z.record(z.string(), z.any()).optional(),
      clientTimestamp: z.coerce.date(),
    })
  ),
});

export const syncPullSchema = z.object({
  deviceId: z.string().min(1, 'Device ID requis'),
  lastSyncTimestamp: z.coerce.date().optional(),
});

export type SyncPushInput = z.infer<typeof syncPushSchema>;
export type SyncPullInput = z.infer<typeof syncPullSchema>;

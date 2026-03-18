import { pgTable, uuid, varchar, text, timestamp, pgEnum, integer, boolean, jsonb } from 'drizzle-orm/pg-core';
import { clients } from './projects';

export const cloudInstanceStatusEnum = pgEnum('cloud_instance_status', [
  'provisioning',
  'running',
  'stopped',
  'error',
  'destroying',
]);

export const cloudInstances = pgTable('cloud_instances', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id')
    .notNull()
    .references(() => clients.id, { onDelete: 'restrict' }),
  tenantId: varchar('tenant_id', { length: 100 }).notNull().unique(),
  containerId: varchar('container_id', { length: 100 }),
  containerName: varchar('container_name', { length: 200 }),
  domain: varchar('domain', { length: 255 }).notNull(),
  status: cloudInstanceStatusEnum('status').notNull().default('provisioning'),
  haVersion: varchar('ha_version', { length: 50 }),
  adminToken: text('admin_token'),
  clientToken: text('client_token'),
  port: integer('port'),
  // Telemetry from heartbeat
  lastHeartbeat: timestamp('last_heartbeat'),
  entityCount: integer('entity_count').default(0),
  automationCount: integer('automation_count').default(0),
  isOnline: boolean('is_online').default(false),
  // Resource limits
  memoryLimitMb: integer('memory_limit_mb').default(512),
  cpuLimit: varchar('cpu_limit', { length: 10 }).default('0.5'),
  // Metadata
  config: jsonb('config').$type<Record<string, unknown>>(),
  errorMessage: text('error_message'),
  provisionedAt: timestamp('provisioned_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type CloudInstance = typeof cloudInstances.$inferSelect;
export type NewCloudInstance = typeof cloudInstances.$inferInsert;

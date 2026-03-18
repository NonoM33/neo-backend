import { pgTable, uuid, real, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { rooms } from './rooms';
import { projects } from './projects';

export const floorPlans = pgTable('floor_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomId: uuid('room_id')
    .notNull()
    .references(() => rooms.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  widthMeters: real('width_meters').notNull().default(10),
  heightMeters: real('height_meters').notNull().default(8),
  pixelsPerMeter: real('pixels_per_meter').notNull().default(100),
  data: jsonb('data').notNull().default('{}'),
  usdzFilePath: text('usdz_file_path'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type FloorPlan = typeof floorPlans.$inferSelect;
export type NewFloorPlan = typeof floorPlans.$inferInsert;

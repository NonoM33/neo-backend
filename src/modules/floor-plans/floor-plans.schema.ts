import { z } from 'zod';

const planPointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const planWallSchema = z.object({
  id: z.string(),
  startPoint: planPointSchema,
  endPoint: planPointSchema,
  thickness: z.number().default(0.15),
  type: z.enum(['exterior', 'interior', 'loadBearing']).default('interior'),
});

const planOpeningSchema = z.object({
  id: z.string(),
  wallId: z.string(),
  type: z.enum(['door', 'window', 'frenchDoor', 'slidingDoor', 'garageOpening']).default('door'),
  offsetOnWall: z.number(),
  widthMeters: z.number().default(0.9),
  heightMeters: z.number().optional(),
  openingSide: z.enum(['left', 'right', 'sliding', 'none']).default('left'),
});

const planEquipmentSchema = z.object({
  id: z.string(),
  productId: z.string(),
  deviceId: z.string().optional(),
  position: planPointSchema,
  rotation: z.number().default(0),
  quantity: z.number().int().default(1),
  label: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['planned', 'ordered', 'installed', 'configured', 'issue']).default('planned'),
});

const planAnnotationSchema = z.object({
  id: z.string(),
  position: planPointSchema,
  type: z.enum(['note', 'measurement', 'warning', 'label']).default('note'),
  text: z.string(),
  colorValue: z.number().int().optional(),
  endPosition: planPointSchema.optional(),
});

export const createFloorPlanSchema = z.object({
  widthMeters: z.number().positive().default(10),
  heightMeters: z.number().positive().default(8),
  pixelsPerMeter: z.number().positive().default(100),
  walls: z.array(planWallSchema).default([]),
  openings: z.array(planOpeningSchema).default([]),
  equipment: z.array(planEquipmentSchema).default([]),
  annotations: z.array(planAnnotationSchema).default([]),
  version: z.number().int().default(1),
  usdzFilePath: z.string().optional(),
});

export const updateFloorPlanSchema = createFloorPlanSchema.partial();

export type CreateFloorPlanInput = z.infer<typeof createFloorPlanSchema>;
export type UpdateFloorPlanInput = z.infer<typeof updateFloorPlanSchema>;

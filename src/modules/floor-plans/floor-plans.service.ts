import { eq, and, SQL } from 'drizzle-orm';
import { db } from '../../config/database';
import { floorPlans } from '../../db/schema';
import { rooms, projects } from '../../db/schema';
import { NotFoundError } from '../../lib/errors';
import type { CreateFloorPlanInput, UpdateFloorPlanInput } from './floor-plans.schema';

async function verifyRoomAccess(roomId: string, userId: string, userRole: string) {
  const [room] = await db
    .select({ id: rooms.id, projectId: rooms.projectId })
    .from(rooms)
    .where(eq(rooms.id, roomId))
    .limit(1);

  if (!room) {
    throw new NotFoundError('Pièce');
  }

  const conditions: SQL[] = [eq(projects.id, room.projectId)];
  if (userRole !== 'admin') {
    conditions.push(eq(projects.userId, userId));
  }

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(...conditions))
    .limit(1);

  if (!project) {
    throw new NotFoundError('Projet');
  }

  return room;
}

export async function getFloorPlanByRoom(roomId: string, userId: string, userRole: string) {
  await verifyRoomAccess(roomId, userId, userRole);

  const [plan] = await db
    .select()
    .from(floorPlans)
    .where(eq(floorPlans.roomId, roomId))
    .limit(1);

  return plan ?? null;
}

export async function createFloorPlan(
  roomId: string,
  input: CreateFloorPlanInput,
  userId: string,
  userRole: string,
) {
  const room = await verifyRoomAccess(roomId, userId, userRole);

  const { walls, openings, equipment, annotations, version, usdzFilePath, ...rest } = input;

  const [plan] = await db
    .insert(floorPlans)
    .values({
      roomId,
      projectId: room.projectId,
      ...rest,
      data: { walls, openings, equipment, annotations, version },
      usdzFilePath,
    })
    .returning();

  return plan;
}

export async function updateFloorPlan(
  id: string,
  input: UpdateFloorPlanInput,
  userId: string,
  userRole: string,
) {
  const [existing] = await db
    .select({ id: floorPlans.id, roomId: floorPlans.roomId })
    .from(floorPlans)
    .where(eq(floorPlans.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Plan');
  }

  await verifyRoomAccess(existing.roomId, userId, userRole);

  const { walls, openings, equipment, annotations, version, usdzFilePath, ...rest } = input;

  // Build data patch only if any data fields are present
  const hasDataFields = walls !== undefined || openings !== undefined ||
    equipment !== undefined || annotations !== undefined || version !== undefined;

  const updatePayload: Record<string, unknown> = {
    ...rest,
    updatedAt: new Date(),
  };

  if (hasDataFields) {
    // Fetch current data to merge
    const [current] = await db
      .select({ data: floorPlans.data })
      .from(floorPlans)
      .where(eq(floorPlans.id, id))
      .limit(1);

    const currentData = (current?.data ?? {}) as Record<string, unknown>;
    updatePayload.data = {
      ...currentData,
      ...(walls !== undefined && { walls }),
      ...(openings !== undefined && { openings }),
      ...(equipment !== undefined && { equipment }),
      ...(annotations !== undefined && { annotations }),
      ...(version !== undefined && { version }),
    };
  }

  if (usdzFilePath !== undefined) {
    updatePayload.usdzFilePath = usdzFilePath;
  }

  const [plan] = await db
    .update(floorPlans)
    .set(updatePayload)
    .where(eq(floorPlans.id, id))
    .returning();

  return plan;
}

export async function upsertFloorPlan(
  roomId: string,
  input: CreateFloorPlanInput,
  userId: string,
  userRole: string,
) {
  const existing = await getFloorPlanByRoom(roomId, userId, userRole);
  if (existing) {
    return updateFloorPlan(existing.id, input, userId, userRole);
  }
  return createFloorPlan(roomId, input, userId, userRole);
}

export async function deleteFloorPlan(id: string, userId: string, userRole: string) {
  const [existing] = await db
    .select({ id: floorPlans.id, roomId: floorPlans.roomId })
    .from(floorPlans)
    .where(eq(floorPlans.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Plan');
  }

  await verifyRoomAccess(existing.roomId, userId, userRole);
  await db.delete(floorPlans).where(eq(floorPlans.id, id));
}

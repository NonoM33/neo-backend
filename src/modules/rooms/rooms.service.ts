import { eq, and, SQL } from 'drizzle-orm';
import { db } from '../../config/database';
import { rooms, photos, checklistItems, projects } from '../../db/schema';
import { NotFoundError, ForbiddenError } from '../../lib/errors';
import type {
  CreateRoomInput,
  UpdateRoomInput,
  CreateChecklistItemInput,
  UpdateChecklistItemInput,
} from './rooms.schema';

async function verifyProjectAccess(projectId: string, userId: string, userRole: string) {
  const conditions: SQL[] = [eq(projects.id, projectId)];

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

  return project;
}

async function verifyRoomAccess(roomId: string, userId: string, userRole: string) {
  const [room] = await db
    .select({
      id: rooms.id,
      projectId: rooms.projectId,
    })
    .from(rooms)
    .where(eq(rooms.id, roomId))
    .limit(1);

  if (!room) {
    throw new NotFoundError('Pièce');
  }

  await verifyProjectAccess(room.projectId, userId, userRole);

  return room;
}

// ============ Rooms ============

export async function getRoomsByProject(projectId: string, userId: string, userRole: string) {
  await verifyProjectAccess(projectId, userId, userRole);

  const roomsList = await db
    .select()
    .from(rooms)
    .where(eq(rooms.projectId, projectId))
    .orderBy(rooms.floor, rooms.name);

  return roomsList;
}

export async function getRoomById(id: string, userId: string, userRole: string) {
  const room = await verifyRoomAccess(id, userId, userRole);

  const [fullRoom] = await db
    .select()
    .from(rooms)
    .where(eq(rooms.id, id))
    .limit(1);

  // Get photos and checklist items
  const [roomPhotos, roomChecklist] = await Promise.all([
    db.select().from(photos).where(eq(photos.roomId, id)),
    db.select().from(checklistItems).where(eq(checklistItems.roomId, id)),
  ]);

  return {
    ...fullRoom,
    photos: roomPhotos,
    checklistItems: roomChecklist,
  };
}

export async function createRoom(projectId: string, input: CreateRoomInput, userId: string, userRole: string) {
  await verifyProjectAccess(projectId, userId, userRole);

  const [room] = await db
    .insert(rooms)
    .values({
      ...input,
      projectId,
    })
    .returning();

  return room;
}

export async function updateRoom(id: string, input: UpdateRoomInput, userId: string, userRole: string) {
  await verifyRoomAccess(id, userId, userRole);

  const [room] = await db
    .update(rooms)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(rooms.id, id))
    .returning();

  return room;
}

export async function deleteRoom(id: string, userId: string, userRole: string) {
  await verifyRoomAccess(id, userId, userRole);
  await db.delete(rooms).where(eq(rooms.id, id));
}

// ============ Checklist Items ============

export async function createChecklistItem(
  roomId: string,
  input: CreateChecklistItemInput,
  userId: string,
  userRole: string
) {
  await verifyRoomAccess(roomId, userId, userRole);

  const [item] = await db
    .insert(checklistItems)
    .values({
      ...input,
      roomId,
    })
    .returning();

  return item;
}

export async function updateChecklistItem(
  id: string,
  input: UpdateChecklistItemInput,
  userId: string,
  userRole: string
) {
  const [item] = await db
    .select({
      id: checklistItems.id,
      roomId: checklistItems.roomId,
    })
    .from(checklistItems)
    .where(eq(checklistItems.id, id))
    .limit(1);

  if (!item) {
    throw new NotFoundError('Item checklist');
  }

  await verifyRoomAccess(item.roomId, userId, userRole);

  const [updated] = await db
    .update(checklistItems)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(checklistItems.id, id))
    .returning();

  return updated;
}

export async function deleteChecklistItem(id: string, userId: string, userRole: string) {
  const [item] = await db
    .select({
      id: checklistItems.id,
      roomId: checklistItems.roomId,
    })
    .from(checklistItems)
    .where(eq(checklistItems.id, id))
    .limit(1);

  if (!item) {
    throw new NotFoundError('Item checklist');
  }

  await verifyRoomAccess(item.roomId, userId, userRole);

  await db.delete(checklistItems).where(eq(checklistItems.id, id));
}

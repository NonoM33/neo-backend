import { eq, and } from 'drizzle-orm';
import { db } from '../../config/database';
import { devices, rooms, projects } from '../../db/schema';
import { NotFoundError, ForbiddenError } from '../../lib/errors';
import type { CreateDeviceInput, UpdateDeviceInput } from './devices.schema';

async function verifyRoomAccess(roomId: string, userId: string, role: string) {
  const [room] = await db
    .select({
      id: rooms.id,
      projectId: rooms.projectId,
      projectUserId: projects.userId,
    })
    .from(rooms)
    .innerJoin(projects, eq(rooms.projectId, projects.id))
    .where(eq(rooms.id, roomId))
    .limit(1);

  if (!room) {
    throw new NotFoundError('Pièce non trouvée');
  }

  if (role !== 'admin' && room.projectUserId !== userId) {
    throw new ForbiddenError('Accès non autorisé à cette pièce');
  }

  return room;
}

async function verifyDeviceAccess(deviceId: string, userId: string, role: string) {
  const [device] = await db
    .select({
      id: devices.id,
      roomId: devices.roomId,
      projectUserId: projects.userId,
    })
    .from(devices)
    .innerJoin(rooms, eq(devices.roomId, rooms.id))
    .innerJoin(projects, eq(rooms.projectId, projects.id))
    .where(eq(devices.id, deviceId))
    .limit(1);

  if (!device) {
    throw new NotFoundError('Device non trouvé');
  }

  if (role !== 'admin' && device.projectUserId !== userId) {
    throw new ForbiddenError('Accès non autorisé à ce device');
  }

  return device;
}

export async function getDevicesByRoom(roomId: string, userId: string, role: string) {
  await verifyRoomAccess(roomId, userId, role);

  return db
    .select()
    .from(devices)
    .where(eq(devices.roomId, roomId))
    .orderBy(devices.name);
}

export async function getDevicesByProject(projectId: string, userId: string, role: string) {
  // Verify project access
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    throw new NotFoundError('Projet non trouvé');
  }

  if (role !== 'admin' && project.userId !== userId) {
    throw new ForbiddenError('Accès non autorisé à ce projet');
  }

  return db
    .select({
      id: devices.id,
      roomId: devices.roomId,
      productId: devices.productId,
      name: devices.name,
      serialNumber: devices.serialNumber,
      macAddress: devices.macAddress,
      ipAddress: devices.ipAddress,
      status: devices.status,
      location: devices.location,
      notes: devices.notes,
      isOnline: devices.isOnline,
      lastSeenAt: devices.lastSeenAt,
      installedAt: devices.installedAt,
      createdAt: devices.createdAt,
      updatedAt: devices.updatedAt,
      roomName: rooms.name,
      roomType: rooms.type,
    })
    .from(devices)
    .innerJoin(rooms, eq(devices.roomId, rooms.id))
    .where(eq(rooms.projectId, projectId))
    .orderBy(rooms.name, devices.name);
}

export async function getDeviceById(id: string, userId: string, role: string) {
  await verifyDeviceAccess(id, userId, role);

  const [device] = await db
    .select()
    .from(devices)
    .where(eq(devices.id, id))
    .limit(1);

  return device;
}

export async function createDevice(
  roomId: string,
  input: CreateDeviceInput,
  userId: string,
  role: string
) {
  await verifyRoomAccess(roomId, userId, role);

  const [device] = await db
    .insert(devices)
    .values({
      roomId,
      ...input,
    })
    .returning();

  return device;
}

export async function updateDevice(
  id: string,
  input: UpdateDeviceInput,
  userId: string,
  role: string
) {
  await verifyDeviceAccess(id, userId, role);

  const [device] = await db
    .update(devices)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(devices.id, id))
    .returning();

  return device;
}

export async function deleteDevice(id: string, userId: string, role: string) {
  await verifyDeviceAccess(id, userId, role);

  await db.delete(devices).where(eq(devices.id, id));
}

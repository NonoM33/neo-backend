import { eq, and, SQL } from 'drizzle-orm';
import { db } from '../../config/database';
import { photos, rooms, projects } from '../../db/schema';
import { uploadFile, deleteFile, getPublicUrl } from '../../config/s3';
import { env } from '../../config/env';
import { NotFoundError } from '../../lib/errors';

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

export async function uploadPhoto(
  roomId: string,
  file: File,
  caption: string | undefined,
  userId: string,
  userRole: string
) {
  await verifyRoomAccess(roomId, userId, userRole);

  const buffer = await file.arrayBuffer();
  const ext = file.name.split('.').pop() || 'jpg';
  const filename = `${roomId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

  const url = await uploadFile(
    env.S3_BUCKET_PHOTOS,
    filename,
    new Uint8Array(buffer),
    file.type
  );

  const [photo] = await db
    .insert(photos)
    .values({
      roomId,
      filename,
      url,
      caption,
    })
    .returning();

  return photo;
}

export async function getPhotosByRoom(roomId: string, userId: string, userRole: string) {
  await verifyRoomAccess(roomId, userId, userRole);

  const photosList = await db
    .select()
    .from(photos)
    .where(eq(photos.roomId, roomId))
    .orderBy(photos.createdAt);

  return photosList;
}

export async function deletePhoto(id: string, userId: string, userRole: string) {
  const [photo] = await db
    .select({
      id: photos.id,
      roomId: photos.roomId,
      filename: photos.filename,
    })
    .from(photos)
    .where(eq(photos.id, id))
    .limit(1);

  if (!photo) {
    throw new NotFoundError('Photo');
  }

  await verifyRoomAccess(photo.roomId, userId, userRole);

  // Delete from S3
  await deleteFile(env.S3_BUCKET_PHOTOS, photo.filename);

  // Delete from database
  await db.delete(photos).where(eq(photos.id, id));
}

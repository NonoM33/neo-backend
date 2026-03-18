import { eq, and, gt, desc } from 'drizzle-orm';
import { db } from '../../config/database';
import {
  syncLog,
  projects,
  rooms,
  photos,
  checklistItems,
  clients,
  leads,
  activities,
} from '../../db/schema';
import type { SyncPushInput, SyncPullInput } from './sync.schema';
import type { JWTPayload } from '../../middleware/auth.middleware';
import { userHasAnyRole } from '../../middleware/rbac.middleware';

export async function getSyncStatus(userId: string) {
  const [lastSync] = await db
    .select({
      lastSyncTimestamp: syncLog.serverTimestamp,
    })
    .from(syncLog)
    .where(eq(syncLog.userId, userId))
    .orderBy(desc(syncLog.serverTimestamp))
    .limit(1);

  return {
    lastSyncTimestamp: lastSync?.lastSyncTimestamp || null,
    serverTime: new Date(),
  };
}

export async function pullChanges(userId: string, input: SyncPullInput, user?: JWTPayload) {
  const changes: Record<string, unknown[]> = {};

  // Get all projects for the user
  const userProjects = await db
    .select()
    .from(projects)
    .where(
      input.lastSyncTimestamp
        ? and(eq(projects.userId, userId), gt(projects.updatedAt, input.lastSyncTimestamp))
        : eq(projects.userId, userId)
    );

  changes.projects = userProjects;

  // Get clients for the user's projects
  const projectIds = userProjects.map((p) => p.id);

  if (projectIds.length > 0) {
    // Get related clients
    const clientIds = [...new Set(userProjects.map((p) => p.clientId))];
    const userClients = await db.select().from(clients);

    changes.clients = userClients.filter((c) => clientIds.includes(c.id));

    // Get rooms for these projects
    const userRooms = await db.select().from(rooms);

    changes.rooms = userRooms.filter((r) => projectIds.includes(r.projectId));

    // Get photos and checklist items
    const roomIds = (changes.rooms as typeof userRooms).map((r) => r.id);

    if (roomIds.length > 0) {
      const userPhotos = await db.select().from(photos);
      changes.photos = userPhotos.filter((p) => roomIds.includes(p.roomId));

      const userChecklist = await db.select().from(checklistItems);
      changes.checklistItems = userChecklist.filter((c) => roomIds.includes(c.roomId));
    } else {
      changes.photos = [];
      changes.checklistItems = [];
    }
  } else {
    changes.clients = [];
    changes.rooms = [];
    changes.photos = [];
    changes.checklistItems = [];
  }

  // CRM data sync - for users with commercial or admin role
  if (user && userHasAnyRole(user, ['admin', 'commercial'])) {
    // Sync leads owned by this user (or all leads for admin)
    const userLeads = await db
      .select()
      .from(leads)
      .where(
        input.lastSyncTimestamp
          ? and(eq(leads.ownerId, userId), gt(leads.updatedAt, input.lastSyncTimestamp))
          : eq(leads.ownerId, userId)
      );

    changes.leads = userLeads;

    // Sync activities owned by this user
    const userActivities = await db
      .select()
      .from(activities)
      .where(
        input.lastSyncTimestamp
          ? and(eq(activities.ownerId, userId), gt(activities.updatedAt, input.lastSyncTimestamp))
          : eq(activities.ownerId, userId)
      );

    changes.activities = userActivities;
  }

  return {
    changes,
    syncTimestamp: new Date(),
  };
}

export async function pushChanges(userId: string, input: SyncPushInput, user?: JWTPayload) {
  const results: {
    success: string[];
    errors: Array<{ recordId: string; error: string }>;
  } = {
    success: [],
    errors: [],
  };

  for (const change of input.changes) {
    try {
      // Log the sync operation
      await db.insert(syncLog).values({
        userId,
        tableName: change.tableName,
        recordId: change.recordId,
        operation: change.operation,
        data: change.data,
        clientTimestamp: change.clientTimestamp,
        deviceId: input.deviceId,
      });

      // Apply the change based on operation type
      if (change.operation === 'update' && change.data) {
        await applyUpdate(change.tableName, change.recordId, change.data, userId, user);
      } else if (change.operation === 'delete') {
        await applyDelete(change.tableName, change.recordId, userId, user);
      }
      // Note: 'create' operations should be handled by the regular API endpoints
      // The sync log will track them but we don't re-create from sync

      results.success.push(change.recordId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      results.errors.push({
        recordId: change.recordId,
        error: message,
      });
    }
  }

  return {
    ...results,
    syncTimestamp: new Date(),
  };
}

async function applyUpdate(
  tableName: string,
  recordId: string,
  data: Record<string, unknown>,
  userId: string,
  user?: JWTPayload
) {
  const updateData = { ...data, updatedAt: new Date() };

  switch (tableName) {
    case 'projects':
      await db
        .update(projects)
        .set(updateData as any)
        .where(and(eq(projects.id, recordId), eq(projects.userId, userId)));
      break;
    case 'rooms':
      await db
        .update(rooms)
        .set(updateData as any)
        .where(eq(rooms.id, recordId));
      break;
    case 'checklistItems':
      await db
        .update(checklistItems)
        .set(updateData as any)
        .where(eq(checklistItems.id, recordId));
      break;
    case 'clients':
      await db
        .update(clients)
        .set(updateData as any)
        .where(eq(clients.id, recordId));
      break;
    // CRM tables
    case 'leads':
      if (user && userHasAnyRole(user, ['admin', 'commercial'])) {
        await db
          .update(leads)
          .set(updateData as any)
          .where(and(eq(leads.id, recordId), eq(leads.ownerId, userId)));
      } else {
        throw new Error('Accès non autorisé aux leads');
      }
      break;
    case 'activities':
      if (user && userHasAnyRole(user, ['admin', 'commercial', 'integrateur'])) {
        await db
          .update(activities)
          .set(updateData as any)
          .where(and(eq(activities.id, recordId), eq(activities.ownerId, userId)));
      } else {
        throw new Error('Accès non autorisé aux activités');
      }
      break;
    default:
      throw new Error(`Table non supportée: ${tableName}`);
  }
}

async function applyDelete(
  tableName: string,
  recordId: string,
  userId: string,
  user?: JWTPayload
) {
  switch (tableName) {
    case 'projects':
      await db
        .delete(projects)
        .where(and(eq(projects.id, recordId), eq(projects.userId, userId)));
      break;
    case 'rooms':
      await db.delete(rooms).where(eq(rooms.id, recordId));
      break;
    case 'checklistItems':
      await db.delete(checklistItems).where(eq(checklistItems.id, recordId));
      break;
    case 'clients':
      await db.delete(clients).where(eq(clients.id, recordId));
      break;
    // CRM tables
    case 'leads':
      if (user && userHasAnyRole(user, ['admin', 'commercial'])) {
        await db
          .delete(leads)
          .where(and(eq(leads.id, recordId), eq(leads.ownerId, userId)));
      } else {
        throw new Error('Accès non autorisé aux leads');
      }
      break;
    case 'activities':
      if (user && userHasAnyRole(user, ['admin', 'commercial', 'integrateur'])) {
        await db
          .delete(activities)
          .where(and(eq(activities.id, recordId), eq(activities.ownerId, userId)));
      } else {
        throw new Error('Accès non autorisé aux activités');
      }
      break;
    default:
      throw new Error(`Table non supportée: ${tableName}`);
  }
}

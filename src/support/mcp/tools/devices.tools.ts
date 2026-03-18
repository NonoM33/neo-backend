import { eq, inArray, and } from 'drizzle-orm';
import { db } from '../../../config/database';
import { devices, rooms, products } from '../../../db/schema';
import { toolRegistry } from '../mcp.registry';
import type { ClientContext } from '../mcp.types';

// ============ Helpers ============

async function getRoomsForProjects(projectIds: string[]) {
  if (projectIds.length === 0) return [];
  return db
    .select({ id: rooms.id, projectId: rooms.projectId })
    .from(rooms)
    .where(inArray(rooms.projectId, projectIds));
}

async function validateRoomBelongsToClient(
  roomId: string,
  projectIds: string[]
): Promise<boolean> {
  if (projectIds.length === 0) return false;
  const [room] = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(
      and(eq(rooms.id, roomId), inArray(rooms.projectId, projectIds))
    )
    .limit(1);
  return !!room;
}

async function validateDeviceBelongsToClient(
  deviceId: string,
  projectIds: string[]
): Promise<boolean> {
  if (projectIds.length === 0) return false;
  const [device] = await db
    .select({ id: devices.id })
    .from(devices)
    .innerJoin(rooms, eq(devices.roomId, rooms.id))
    .where(
      and(eq(devices.id, deviceId), inArray(rooms.projectId, projectIds))
    )
    .limit(1);
  return !!device;
}

// ============ get_room_devices ============

toolRegistry.register({
  name: 'get_room_devices',
  description:
    "Liste tous les appareils installes dans une piece avec leur statut de connexion.",
  inputSchema: {
    type: 'object',
    properties: {
      roomId: { type: 'string', description: 'ID de la piece' },
    },
    required: ['roomId'],
  },
  handler: async (ctx: ClientContext, params: { roomId: string }) => {
    if (!params.roomId) {
      return { success: false, error: 'roomId est requis.' };
    }

    const roomValid = await validateRoomBelongsToClient(
      params.roomId,
      ctx.projectIds
    );
    if (!roomValid) {
      return {
        success: false,
        error: "Acces refuse: cette piece ne vous appartient pas.",
      };
    }

    const data = await db
      .select({
        id: devices.id,
        name: devices.name,
        status: devices.status,
        isOnline: devices.isOnline,
        lastSeenAt: devices.lastSeenAt,
        location: devices.location,
        productName: products.name,
        productDescription: products.description,
      })
      .from(devices)
      .leftJoin(products, eq(devices.productId, products.id))
      .where(eq(devices.roomId, params.roomId));

    return { success: true, data };
  },
});

// ============ get_device_detail ============

toolRegistry.register({
  name: 'get_device_detail',
  description:
    "Retourne les informations detaillees d'un appareil specifique (sans donnees sensibles).",
  inputSchema: {
    type: 'object',
    properties: {
      deviceId: { type: 'string', description: "ID de l'appareil" },
    },
    required: ['deviceId'],
  },
  handler: async (ctx: ClientContext, params: { deviceId: string }) => {
    if (!params.deviceId) {
      return { success: false, error: 'deviceId est requis.' };
    }

    const deviceValid = await validateDeviceBelongsToClient(
      params.deviceId,
      ctx.projectIds
    );
    if (!deviceValid) {
      return {
        success: false,
        error: "Acces refuse: cet appareil ne vous appartient pas.",
      };
    }

    const [data] = await db
      .select({
        id: devices.id,
        name: devices.name,
        status: devices.status,
        location: devices.location,
        notes: devices.notes,
        isOnline: devices.isOnline,
        lastSeenAt: devices.lastSeenAt,
        installedAt: devices.installedAt,
        roomId: devices.roomId,
        roomName: rooms.name,
        roomType: rooms.type,
        productName: products.name,
        productDescription: products.description,
        productCategory: products.category,
        productBrand: products.brand,
      })
      .from(devices)
      .innerJoin(rooms, eq(devices.roomId, rooms.id))
      .leftJoin(products, eq(devices.productId, products.id))
      .where(eq(devices.id, params.deviceId))
      .limit(1);

    if (!data) {
      return { success: false, error: 'Appareil introuvable.' };
    }

    return { success: true, data };
  },
});

// ============ get_all_devices_status ============

toolRegistry.register({
  name: 'get_all_devices_status',
  description:
    "Retourne un resume de l'etat de tous les appareils du client: total, en ligne, hors ligne, en panne.",
  inputSchema: { type: 'object', properties: {}, required: [] },
  handler: async (ctx: ClientContext) => {
    if (ctx.projectIds.length === 0) {
      return {
        success: true,
        data: {
          total: 0,
          online: 0,
          offline: 0,
          byStatus: {},
          problematicDevices: [],
        },
      };
    }

    const clientRooms = await getRoomsForProjects(ctx.projectIds);
    const roomIds = clientRooms.map((r) => r.id);

    if (roomIds.length === 0) {
      return {
        success: true,
        data: {
          total: 0,
          online: 0,
          offline: 0,
          byStatus: {},
          problematicDevices: [],
        },
      };
    }

    const allDevices = await db
      .select({
        id: devices.id,
        name: devices.name,
        status: devices.status,
        isOnline: devices.isOnline,
        lastSeenAt: devices.lastSeenAt,
        location: devices.location,
        roomName: rooms.name,
        productName: products.name,
      })
      .from(devices)
      .innerJoin(rooms, eq(devices.roomId, rooms.id))
      .leftJoin(products, eq(devices.productId, products.id))
      .where(inArray(devices.roomId, roomIds));

    const total = allDevices.length;
    const online = allDevices.filter((d) => d.isOnline).length;
    const offline = total - online;

    // Breakdown by status
    const byStatus: Record<string, number> = {};
    for (const d of allDevices) {
      byStatus[d.status] = (byStatus[d.status] || 0) + 1;
    }

    // Problematic devices: en_panne or offline
    const problematicDevices = allDevices
      .filter((d) => d.status === 'en_panne' || !d.isOnline)
      .map((d) => ({
        id: d.id,
        name: d.name,
        status: d.status,
        isOnline: d.isOnline,
        lastSeenAt: d.lastSeenAt,
        roomName: d.roomName,
        productName: d.productName,
      }));

    return {
      success: true,
      data: {
        total,
        online,
        offline,
        byStatus,
        problematicDevices,
      },
    };
  },
});

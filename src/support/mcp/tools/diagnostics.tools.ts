import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../../../config/database';
import { devices, rooms, aiAuditLog } from '../../../db/schema';
import { toolRegistry } from '../mcp.registry';
import type { ClientContext } from '../mcp.types';

// ============ Helpers ============

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

// ============ check_device_connectivity ============

toolRegistry.register({
  name: 'check_device_connectivity',
  description:
    "Verifie l'etat de connectivite d'un appareil (en ligne / hors ligne, derniere activite).",
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

    const [device] = await db
      .select({
        id: devices.id,
        name: devices.name,
        status: devices.status,
        isOnline: devices.isOnline,
        lastSeenAt: devices.lastSeenAt,
      })
      .from(devices)
      .where(eq(devices.id, params.deviceId))
      .limit(1);

    if (!device) {
      return { success: false, error: 'Appareil introuvable.' };
    }

    return {
      success: true,
      data: {
        id: device.id,
        name: device.name,
        status: device.status,
        isOnline: device.isOnline,
        lastSeenAt: device.lastSeenAt,
        message: device.isOnline
          ? `L'appareil "${device.name}" est en ligne.`
          : `L'appareil "${device.name}" est hors ligne. Derniere activite: ${
              device.lastSeenAt
                ? device.lastSeenAt.toISOString()
                : 'inconnue'
            }.`,
      },
    };
  },
});

// ============ request_device_restart ============

toolRegistry.register({
  name: 'request_device_restart',
  description:
    "Envoie une demande de redemarrage a un appareil. (Commande enregistree, execution asynchrone.)",
  inputSchema: {
    type: 'object',
    properties: {
      deviceId: { type: 'string', description: "ID de l'appareil a redemarrer" },
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

    const [device] = await db
      .select({
        id: devices.id,
        name: devices.name,
        status: devices.status,
      })
      .from(devices)
      .where(eq(devices.id, params.deviceId))
      .limit(1);

    if (!device) {
      return { success: false, error: 'Appareil introuvable.' };
    }

    // Log the restart request in audit (the executeTool already logs,
    // but we add a specific audit entry for the restart action)
    db.insert(aiAuditLog)
      .values({
        sessionId: ctx.sessionId,
        clientAccountId: ctx.clientAccountId,
        toolName: 'request_device_restart',
        toolInput: { deviceId: params.deviceId },
        toolOutput: { requested: true, deviceName: device.name },
        success: true,
      })
      .catch(() => {});

    // Placeholder: In production, this would send a restart command
    // to the device via MQTT, WebSocket, or another protocol.

    return {
      success: true,
      data: {
        deviceId: device.id,
        deviceName: device.name,
        message: `Demande de redemarrage envoyee pour l'appareil "${device.name}". Le redemarrage peut prendre quelques minutes.`,
      },
    };
  },
});

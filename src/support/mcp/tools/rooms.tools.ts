import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../../../config/database';
import { rooms } from '../../../db/schema';
import { toolRegistry } from '../mcp.registry';
import type { ClientContext } from '../mcp.types';

toolRegistry.register({
  name: 'get_project_rooms',
  description:
    "Liste toutes les pieces d'un projet domotique avec leur type et etage.",
  inputSchema: {
    type: 'object',
    properties: {
      projectId: { type: 'string', description: 'ID du projet' },
    },
    required: ['projectId'],
  },
  handler: async (ctx: ClientContext, params: { projectId: string }) => {
    if (!params.projectId) {
      return { success: false, error: 'projectId est requis.' };
    }

    if (!ctx.projectIds.includes(params.projectId)) {
      return {
        success: false,
        error: "Acces refuse: ce projet ne vous appartient pas.",
      };
    }

    const data = await db
      .select({
        id: rooms.id,
        name: rooms.name,
        type: rooms.type,
        floor: rooms.floor,
        notes: rooms.notes,
      })
      .from(rooms)
      .where(eq(rooms.projectId, params.projectId));

    return { success: true, data };
  },
});

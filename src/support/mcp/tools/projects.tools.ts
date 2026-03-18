import { inArray } from 'drizzle-orm';
import { db } from '../../../config/database';
import { projects } from '../../../db/schema';
import { toolRegistry } from '../mcp.registry';
import type { ClientContext } from '../mcp.types';

toolRegistry.register({
  name: 'get_my_projects',
  description: 'Liste tous les projets domotique du client avec leur statut et adresse.',
  inputSchema: { type: 'object', properties: {}, required: [] },
  handler: async (ctx: ClientContext) => {
    if (ctx.projectIds.length === 0) {
      return { success: true, data: [] };
    }

    const data = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        status: projects.status,
        address: projects.address,
        city: projects.city,
        postalCode: projects.postalCode,
      })
      .from(projects)
      .where(inArray(projects.id, ctx.projectIds));

    return { success: true, data };
  },
});

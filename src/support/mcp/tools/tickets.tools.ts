import { eq, and, desc, inArray } from 'drizzle-orm';
import { db } from '../../../config/database';
import { tickets, ticketComments } from '../../../db/schema';
import { toolRegistry } from '../mcp.registry';
import type { ClientContext } from '../mcp.types';
import * as ticketsService from '../../tickets/tickets.service';

// ============ create_support_ticket ============

toolRegistry.register({
  name: 'create_support_ticket',
  description:
    "Cree un ticket de support technique suite au diagnostic de l'IA.",
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Titre du ticket' },
      description: {
        type: 'string',
        description: 'Description detaillee du probleme',
      },
      priority: {
        type: 'string',
        enum: ['basse', 'normale', 'haute', 'urgente', 'critique'],
        description: 'Priorite du ticket',
      },
      category: {
        type: 'string',
        description: 'ID de la categorie du ticket',
      },
      aiDiagnosis: {
        type: 'string',
        description: "Resume du diagnostic effectue par l'IA",
      },
      troubleshootingSteps: {
        type: 'array',
        items: { type: 'string' },
        description: 'Etapes de depannage deja tentees',
      },
      affectedDeviceIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'IDs des appareils concernes',
      },
      projectId: {
        type: 'string',
        description: 'ID du projet concerne',
      },
    },
    required: ['title', 'description', 'aiDiagnosis'],
  },
  handler: async (
    ctx: ClientContext,
    params: {
      title: string;
      description: string;
      priority?: string;
      category?: string;
      aiDiagnosis: string;
      troubleshootingSteps?: string[];
      affectedDeviceIds?: string[];
      projectId?: string;
    }
  ) => {
    if (!params.title || !params.description || !params.aiDiagnosis) {
      return {
        success: false,
        error: 'title, description et aiDiagnosis sont requis.',
      };
    }

    // Validate projectId belongs to client
    if (params.projectId && !ctx.projectIds.includes(params.projectId)) {
      return {
        success: false,
        error: "Acces refuse: ce projet ne vous appartient pas.",
      };
    }

    // Pick the first affected device if provided
    const deviceId =
      params.affectedDeviceIds && params.affectedDeviceIds.length > 0
        ? params.affectedDeviceIds[0]
        : undefined;

    const ticket = await ticketsService.createTicket({
      title: params.title,
      description: params.description,
      priority: (params.priority as any) ?? 'normale',
      source: 'chat_ai',
      categoryId: params.category,
      clientId: ctx.clientId,
      projectId: params.projectId,
      deviceId,
      aiDiagnosis: params.aiDiagnosis,
      troubleshootingSteps: params.troubleshootingSteps,
      chatSessionId: ctx.sessionId,
      tags: params.affectedDeviceIds
        ? ['chat_ai', 'multi_devices']
        : ['chat_ai'],
    });

    return {
      success: true,
      data: {
        id: ticket!.id,
        number: ticket!.number,
        title: ticket!.title,
        status: ticket!.status,
        priority: ticket!.priority,
        createdAt: ticket!.createdAt,
      },
    };
  },
});

// ============ get_my_tickets ============

toolRegistry.register({
  name: 'get_my_tickets',
  description:
    'Liste les tickets de support du client, avec filtre optionnel par statut.',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: [
          'nouveau',
          'ouvert',
          'en_attente_client',
          'en_attente_interne',
          'escalade',
          'resolu',
          'ferme',
        ],
        description: 'Filtrer par statut',
      },
      limit: {
        type: 'number',
        description: 'Nombre maximum de resultats (defaut: 10)',
      },
    },
    required: [],
  },
  handler: async (
    ctx: ClientContext,
    params: { status?: string; limit?: number }
  ) => {
    const queryLimit = Math.min(params.limit || 10, 50);

    const conditions = [eq(tickets.clientId, ctx.clientId)];

    if (params.status) {
      conditions.push(eq(tickets.status, params.status as any));
    }

    const data = await db
      .select({
        id: tickets.id,
        number: tickets.number,
        title: tickets.title,
        status: tickets.status,
        priority: tickets.priority,
        createdAt: tickets.createdAt,
        updatedAt: tickets.updatedAt,
        resolvedAt: tickets.resolvedAt,
      })
      .from(tickets)
      .where(and(...conditions))
      .orderBy(desc(tickets.createdAt))
      .limit(queryLimit);

    return { success: true, data };
  },
});

// ============ add_ticket_comment ============

toolRegistry.register({
  name: 'add_ticket_comment',
  description: "Ajoute un commentaire a un ticket de support existant.",
  inputSchema: {
    type: 'object',
    properties: {
      ticketId: { type: 'string', description: 'ID du ticket' },
      content: { type: 'string', description: 'Contenu du commentaire' },
    },
    required: ['ticketId', 'content'],
  },
  handler: async (
    ctx: ClientContext,
    params: { ticketId: string; content: string }
  ) => {
    if (!params.ticketId || !params.content) {
      return {
        success: false,
        error: 'ticketId et content sont requis.',
      };
    }

    // Verify ticket belongs to client
    const [ticket] = await db
      .select({ id: tickets.id })
      .from(tickets)
      .where(
        and(
          eq(tickets.id, params.ticketId),
          eq(tickets.clientId, ctx.clientId)
        )
      )
      .limit(1);

    if (!ticket) {
      return {
        success: false,
        error: 'Ticket introuvable ou ne vous appartient pas.',
      };
    }

    const [comment] = await db
      .insert(ticketComments)
      .values({
        ticketId: params.ticketId,
        authorType: 'client',
        authorId: ctx.clientAccountId,
        type: 'public',
        content: params.content,
      })
      .returning();

    return {
      success: true,
      data: {
        id: comment!.id,
        ticketId: comment!.ticketId,
        content: comment!.content,
        createdAt: comment!.createdAt,
      },
    };
  },
});

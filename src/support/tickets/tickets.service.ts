import { eq, ilike, or, count, and, desc, asc, SQL, gte, lte, inArray, sql, isNull } from 'drizzle-orm';
import { db } from '../../config/database';
import {
  tickets,
  ticketComments,
  ticketHistory,
  ticketCategories,
  slaDefinitions,
  cannedResponses,
  clients,
  projects,
  users,
  devices,
  rooms,
} from '../../db/schema';
import { NotFoundError, ValidationError, ForbiddenError } from '../../lib/errors';
import { paginate, getOffset, type PaginationParams } from '../../lib/pagination';
import type {
  CreateTicketInput,
  UpdateTicketInput,
  ChangeStatusInput,
  AddCommentInput,
  TicketFilter,
  CreateSlaInput,
  UpdateSlaInput,
} from './tickets.schema';

// ============ Helpers ============

export async function generateTicketNumber(): Promise<string> {
  const [last] = await db
    .select({ number: tickets.number })
    .from(tickets)
    .orderBy(desc(tickets.createdAt))
    .limit(1);

  let next = 1;
  if (last?.number) {
    const numeric = parseInt(last.number.replace('TK-', ''), 10);
    if (!isNaN(numeric)) {
      next = numeric + 1;
    }
  }

  return `TK-${String(next).padStart(6, '0')}`;
}

export function getValidStatusTransitions(currentStatus: string): string[] {
  const transitions: Record<string, string[]> = {
    nouveau: ['ouvert', 'escalade', 'ferme'],
    ouvert: ['en_attente_client', 'en_attente_interne', 'escalade', 'resolu', 'ferme'],
    en_attente_client: ['ouvert', 'resolu', 'ferme'],
    en_attente_interne: ['ouvert', 'escalade', 'ferme'],
    escalade: ['ouvert', 'en_attente_interne', 'resolu', 'ferme'],
    resolu: ['ouvert', 'ferme'],
    ferme: ['ouvert'],
  };

  return transitions[currentStatus] ?? [];
}

export async function findSlaDefinition(
  priority: string,
  categoryId?: string | null
): Promise<typeof slaDefinitions.$inferSelect | null> {
  // Priority + category match
  if (categoryId) {
    const [match] = await db
      .select()
      .from(slaDefinitions)
      .where(
        and(
          eq(slaDefinitions.priority, priority as any),
          eq(slaDefinitions.categoryId, categoryId),
          eq(slaDefinitions.isActive, true)
        )
      )
      .limit(1);
    if (match) return match;
  }

  // Priority-only match
  const [priorityMatch] = await db
    .select()
    .from(slaDefinitions)
    .where(
      and(
        eq(slaDefinitions.priority, priority as any),
        isNull(slaDefinitions.categoryId),
        eq(slaDefinitions.isActive, true)
      )
    )
    .limit(1);
  if (priorityMatch) return priorityMatch;

  // Category-only match
  if (categoryId) {
    const [categoryMatch] = await db
      .select()
      .from(slaDefinitions)
      .where(
        and(
          isNull(slaDefinitions.priority),
          eq(slaDefinitions.categoryId, categoryId),
          eq(slaDefinitions.isActive, true)
        )
      )
      .limit(1);
    if (categoryMatch) return categoryMatch;
  }

  // Default SLA
  const [defaultSla] = await db
    .select()
    .from(slaDefinitions)
    .where(
      and(
        eq(slaDefinitions.isDefault, true),
        eq(slaDefinitions.isActive, true)
      )
    )
    .limit(1);

  return defaultSla ?? null;
}

export async function autoAssign(projectId?: string | null): Promise<string | null> {
  // If a project is linked, assign to the project's user (intégrateur)
  if (projectId) {
    const [project] = await db
      .select({ userId: projects.userId })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (project?.userId) {
      return project.userId;
    }
  }

  // Find the intégrateur with fewest open tickets
  const openStatuses = ['nouveau', 'ouvert', 'en_attente_client', 'en_attente_interne', 'escalade'];
  const ticketCountSubquery = db
    .select({
      assignedToId: tickets.assignedToId,
      ticketCount: count().as('ticket_count'),
    })
    .from(tickets)
    .where(inArray(tickets.status, openStatuses as any))
    .groupBy(tickets.assignedToId)
    .as('ticket_counts');

  const [leastBusy] = await db
    .select({
      id: users.id,
    })
    .from(users)
    .leftJoin(ticketCountSubquery, eq(users.id, ticketCountSubquery.assignedToId))
    .where(
      and(
        eq(users.role, 'integrateur'),
        eq(users.isActive, true)
      )
    )
    .orderBy(asc(sql`coalesce(${ticketCountSubquery.ticketCount}, 0)`))
    .limit(1);

  return leastBusy?.id ?? null;
}

// ============ Tickets CRUD ============

export async function createTicket(input: CreateTicketInput, reportedById?: string) {
  const number = await generateTicketNumber();

  // Auto-assign if not specified
  let assignedToId = input.assignedToId ?? null;
  if (!assignedToId) {
    assignedToId = await autoAssign(input.projectId);
  }

  // Find SLA definition and compute due dates
  const slaDef = await findSlaDefinition(input.priority ?? 'normale', input.categoryId);
  const now = new Date();
  let slaDefinitionId: string | null = null;
  let firstResponseDueAt: Date | null = null;
  let resolutionDueAt: Date | null = null;

  if (slaDef) {
    slaDefinitionId = slaDef.id;
    firstResponseDueAt = new Date(now.getTime() + slaDef.firstResponseMinutes * 60 * 1000);
    resolutionDueAt = new Date(now.getTime() + slaDef.resolutionMinutes * 60 * 1000);
  }

  const [ticket] = await db
    .insert(tickets)
    .values({
      number,
      title: input.title,
      description: input.description,
      priority: input.priority ?? 'normale',
      source: input.source ?? 'portail',
      categoryId: input.categoryId,
      clientId: input.clientId,
      projectId: input.projectId,
      deviceId: input.deviceId,
      roomId: input.roomId,
      reportedById: reportedById ?? null,
      assignedToId,
      slaDefinitionId,
      firstResponseDueAt,
      resolutionDueAt,
      tags: input.tags,
      aiDiagnosis: input.aiDiagnosis,
      troubleshootingSteps: input.troubleshootingSteps,
      chatSessionId: input.chatSessionId,
    })
    .returning();

  // Create history entry for creation
  await db.insert(ticketHistory).values({
    ticketId: ticket!.id,
    changeType: 'status',
    field: 'status',
    oldValue: null,
    newValue: 'nouveau',
    changedById: reportedById ?? null,
    changedByType: reportedById ? 'staff' : 'client',
    notes: 'Ticket créé',
  });

  return ticket;
}

export async function getTickets(params: PaginationParams, filters: TicketFilter) {
  const conditions: SQL[] = [];

  if (filters.status) {
    conditions.push(eq(tickets.status, filters.status));
  }

  if (filters.priority) {
    conditions.push(eq(tickets.priority, filters.priority));
  }

  if (filters.assignedToId) {
    conditions.push(eq(tickets.assignedToId, filters.assignedToId));
  }

  if (filters.clientId) {
    conditions.push(eq(tickets.clientId, filters.clientId));
  }

  if (filters.categoryId) {
    conditions.push(eq(tickets.categoryId, filters.categoryId));
  }

  if (filters.slaBreached !== undefined) {
    conditions.push(eq(tickets.slaBreached, filters.slaBreached));
  }

  if (filters.search) {
    conditions.push(
      or(
        ilike(tickets.title, `%${filters.search}%`),
        ilike(tickets.description, `%${filters.search}%`)
      )!
    );
  }

  if (filters.dateFrom) {
    conditions.push(gte(tickets.createdAt, new Date(filters.dateFrom)));
  }

  if (filters.dateTo) {
    conditions.push(lte(tickets.createdAt, new Date(filters.dateTo)));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db
      .select({
        id: tickets.id,
        number: tickets.number,
        title: tickets.title,
        status: tickets.status,
        priority: tickets.priority,
        source: tickets.source,
        slaBreached: tickets.slaBreached,
        escalationLevel: tickets.escalationLevel,
        firstResponseDueAt: tickets.firstResponseDueAt,
        resolutionDueAt: tickets.resolutionDueAt,
        resolvedAt: tickets.resolvedAt,
        createdAt: tickets.createdAt,
        updatedAt: tickets.updatedAt,
        client: {
          id: clients.id,
          firstName: clients.firstName,
          lastName: clients.lastName,
        },
        assignedTo: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
        },
        category: {
          id: ticketCategories.id,
          name: ticketCategories.name,
        },
      })
      .from(tickets)
      .innerJoin(clients, eq(tickets.clientId, clients.id))
      .leftJoin(users, eq(tickets.assignedToId, users.id))
      .leftJoin(ticketCategories, eq(tickets.categoryId, ticketCategories.id))
      .where(where)
      .limit(params.limit)
      .offset(getOffset(params))
      .orderBy(desc(tickets.createdAt)),
    db.select({ total: count() }).from(tickets).where(where),
  ]);

  const total = countResult[0]?.total ?? 0;
  return paginate(data, total, params);
}

export async function getTicketById(id: string) {
  const [ticket] = await db
    .select({
      id: tickets.id,
      number: tickets.number,
      title: tickets.title,
      description: tickets.description,
      status: tickets.status,
      priority: tickets.priority,
      source: tickets.source,
      categoryId: tickets.categoryId,
      slaBreached: tickets.slaBreached,
      escalationLevel: tickets.escalationLevel,
      tags: tickets.tags,
      aiDiagnosis: tickets.aiDiagnosis,
      troubleshootingSteps: tickets.troubleshootingSteps,
      chatSessionId: tickets.chatSessionId,
      slaDefinitionId: tickets.slaDefinitionId,
      firstResponseAt: tickets.firstResponseAt,
      firstResponseDueAt: tickets.firstResponseDueAt,
      resolutionDueAt: tickets.resolutionDueAt,
      resolvedAt: tickets.resolvedAt,
      closedAt: tickets.closedAt,
      satisfactionRating: tickets.satisfactionRating,
      satisfactionComment: tickets.satisfactionComment,
      metadata: tickets.metadata,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
      client: {
        id: clients.id,
        firstName: clients.firstName,
        lastName: clients.lastName,
        email: clients.email,
      },
      assignedTo: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      },
      category: {
        id: ticketCategories.id,
        name: ticketCategories.name,
        slug: ticketCategories.slug,
      },
    })
    .from(tickets)
    .innerJoin(clients, eq(tickets.clientId, clients.id))
    .leftJoin(users, eq(tickets.assignedToId, users.id))
    .leftJoin(ticketCategories, eq(tickets.categoryId, ticketCategories.id))
    .where(eq(tickets.id, id))
    .limit(1);

  if (!ticket) {
    throw new NotFoundError('Ticket');
  }

  // Fetch comments and recent history in parallel
  const [comments, history] = await Promise.all([
    db
      .select()
      .from(ticketComments)
      .where(eq(ticketComments.ticketId, id))
      .orderBy(asc(ticketComments.createdAt)),
    db
      .select()
      .from(ticketHistory)
      .where(eq(ticketHistory.ticketId, id))
      .orderBy(desc(ticketHistory.createdAt))
      .limit(20),
  ]);

  return { ...ticket, comments, history };
}

export async function updateTicket(id: string, input: UpdateTicketInput, changedById: string) {
  const [existing] = await db
    .select()
    .from(tickets)
    .where(eq(tickets.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Ticket');
  }

  const [updated] = await db
    .update(tickets)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(tickets.id, id))
    .returning();

  // Log changes to history for each changed field
  const trackableFields = ['title', 'description', 'priority', 'categoryId', 'projectId', 'deviceId', 'roomId', 'tags'] as const;
  const historyEntries = [];

  for (const field of trackableFields) {
    if (input[field] !== undefined) {
      const oldVal = (existing as any)[field];
      const newVal = (input as any)[field];
      const oldStr = oldVal != null ? String(oldVal) : null;
      const newStr = newVal != null ? String(newVal) : null;

      if (oldStr !== newStr) {
        historyEntries.push({
          ticketId: id,
          changeType: field === 'priority' ? ('priority' as const) : ('custom' as const),
          field,
          oldValue: oldStr,
          newValue: newStr,
          changedById,
          changedByType: 'staff' as const,
        });
      }
    }
  }

  if (historyEntries.length > 0) {
    await db.insert(ticketHistory).values(historyEntries);
  }

  return updated;
}

export async function changeStatus(
  id: string,
  newStatus: string,
  changedById: string,
  notes?: string
) {
  const [existing] = await db
    .select()
    .from(tickets)
    .where(eq(tickets.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Ticket');
  }

  const validTransitions = getValidStatusTransitions(existing.status);
  if (!validTransitions.includes(newStatus)) {
    throw new ValidationError(
      `Transition de statut invalide: ${existing.status} → ${newStatus}. Transitions valides: ${validTransitions.join(', ')}`
    );
  }

  const now = new Date();
  const updateData: Record<string, any> = {
    status: newStatus,
    updatedAt: now,
  };

  if (newStatus === 'resolu') {
    updateData.resolvedAt = now;
  }

  if (newStatus === 'ferme') {
    updateData.closedAt = now;
  }

  // If reopening, clear resolved/closed timestamps
  if (newStatus === 'ouvert' && (existing.status === 'resolu' || existing.status === 'ferme')) {
    updateData.resolvedAt = null;
    updateData.closedAt = null;
  }

  const [updated] = await db
    .update(tickets)
    .set(updateData)
    .where(eq(tickets.id, id))
    .returning();

  // Create history entry
  await db.insert(ticketHistory).values({
    ticketId: id,
    changeType: 'status',
    field: 'status',
    oldValue: existing.status,
    newValue: newStatus,
    changedById,
    changedByType: 'staff',
    notes: notes ?? null,
  });

  return updated;
}

export async function assignTicket(id: string, assignedToId: string | null, changedById: string) {
  const [existing] = await db
    .select({ id: tickets.id, assignedToId: tickets.assignedToId })
    .from(tickets)
    .where(eq(tickets.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Ticket');
  }

  const [updated] = await db
    .update(tickets)
    .set({ assignedToId, updatedAt: new Date() })
    .where(eq(tickets.id, id))
    .returning();

  await db.insert(ticketHistory).values({
    ticketId: id,
    changeType: 'assignment',
    field: 'assignedToId',
    oldValue: existing.assignedToId,
    newValue: assignedToId,
    changedById,
    changedByType: 'staff',
  });

  return updated;
}

export async function escalateTicket(id: string, changedById: string) {
  const [existing] = await db
    .select({ id: tickets.id, escalationLevel: tickets.escalationLevel, status: tickets.status })
    .from(tickets)
    .where(eq(tickets.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Ticket');
  }

  const newLevel = existing.escalationLevel + 1;

  const [updated] = await db
    .update(tickets)
    .set({
      escalationLevel: newLevel,
      status: 'escalade',
      updatedAt: new Date(),
    })
    .where(eq(tickets.id, id))
    .returning();

  await db.insert(ticketHistory).values({
    ticketId: id,
    changeType: 'escalation',
    field: 'escalationLevel',
    oldValue: String(existing.escalationLevel),
    newValue: String(newLevel),
    changedById,
    changedByType: 'staff',
    notes: `Escalade au niveau ${newLevel}`,
  });

  return updated;
}

export async function addComment(
  ticketId: string,
  input: AddCommentInput,
  authorId: string,
  authorType: 'client' | 'staff' | 'ai'
) {
  // Verify ticket exists
  const [ticket] = await db
    .select({ id: tickets.id, firstResponseAt: tickets.firstResponseAt })
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .limit(1);

  if (!ticket) {
    throw new NotFoundError('Ticket');
  }

  const [comment] = await db
    .insert(ticketComments)
    .values({
      ticketId,
      authorType,
      authorId,
      type: input.type ?? 'public',
      content: input.content,
    })
    .returning();

  // If this is the first staff response, record firstResponseAt
  if (authorType === 'staff' && !ticket.firstResponseAt) {
    await db
      .update(tickets)
      .set({ firstResponseAt: new Date(), updatedAt: new Date() })
      .where(eq(tickets.id, ticketId));
  }

  return comment;
}

export async function getTicketHistory(ticketId: string) {
  // Verify ticket exists
  const [ticket] = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .limit(1);

  if (!ticket) {
    throw new NotFoundError('Ticket');
  }

  return db
    .select()
    .from(ticketHistory)
    .where(eq(ticketHistory.ticketId, ticketId))
    .orderBy(desc(ticketHistory.createdAt));
}

export async function getTicketStats() {
  const openStatuses = ['nouveau', 'ouvert', 'en_attente_client', 'en_attente_interne', 'escalade'];

  const [
    totalOpenResult,
    byStatusResult,
    byPriorityResult,
    slaBreachedResult,
    avgResolutionResult,
  ] = await Promise.all([
    db
      .select({ total: count() })
      .from(tickets)
      .where(inArray(tickets.status, openStatuses as any)),
    db
      .select({ status: tickets.status, total: count() })
      .from(tickets)
      .groupBy(tickets.status),
    db
      .select({ priority: tickets.priority, total: count() })
      .from(tickets)
      .where(inArray(tickets.status, openStatuses as any))
      .groupBy(tickets.priority),
    db
      .select({ total: count() })
      .from(tickets)
      .where(
        and(
          eq(tickets.slaBreached, true),
          inArray(tickets.status, openStatuses as any)
        )
      ),
    db
      .select({
        avg: sql<number>`avg(extract(epoch from (${tickets.resolvedAt} - ${tickets.createdAt})) / 3600)`,
      })
      .from(tickets)
      .where(sql`${tickets.resolvedAt} is not null`),
  ]);

  return {
    totalOpen: totalOpenResult[0]?.total ?? 0,
    byStatus: byStatusResult,
    byPriority: byPriorityResult,
    slaBreached: slaBreachedResult[0]?.total ?? 0,
    avgResolutionHours: avgResolutionResult[0]?.avg
      ? Math.round(avgResolutionResult[0].avg * 10) / 10
      : null,
  };
}

// ============ Client-facing ============

export async function getClientTickets(
  clientId: string,
  params: PaginationParams,
  status?: string
) {
  const conditions: SQL[] = [eq(tickets.clientId, clientId)];

  if (status) {
    conditions.push(eq(tickets.status, status as any));
  }

  const where = and(...conditions);

  const [data, countResult] = await Promise.all([
    db
      .select({
        id: tickets.id,
        number: tickets.number,
        title: tickets.title,
        status: tickets.status,
        priority: tickets.priority,
        createdAt: tickets.createdAt,
        updatedAt: tickets.updatedAt,
        resolvedAt: tickets.resolvedAt,
        satisfactionRating: tickets.satisfactionRating,
      })
      .from(tickets)
      .where(where)
      .limit(params.limit)
      .offset(getOffset(params))
      .orderBy(desc(tickets.createdAt)),
    db.select({ total: count() }).from(tickets).where(where),
  ]);

  const total = countResult[0]?.total ?? 0;
  return paginate(data, total, params);
}

export async function getClientTicketById(ticketId: string, clientId: string) {
  const [ticket] = await db
    .select({
      id: tickets.id,
      number: tickets.number,
      title: tickets.title,
      description: tickets.description,
      status: tickets.status,
      priority: tickets.priority,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
      resolvedAt: tickets.resolvedAt,
      closedAt: tickets.closedAt,
      satisfactionRating: tickets.satisfactionRating,
      satisfactionComment: tickets.satisfactionComment,
    })
    .from(tickets)
    .where(and(eq(tickets.id, ticketId), eq(tickets.clientId, clientId)))
    .limit(1);

  if (!ticket) {
    throw new NotFoundError('Ticket');
  }

  // Only public comments for client view
  const comments = await db
    .select()
    .from(ticketComments)
    .where(
      and(
        eq(ticketComments.ticketId, ticketId),
        eq(ticketComments.type, 'public')
      )
    )
    .orderBy(asc(ticketComments.createdAt));

  return { ...ticket, comments };
}

export async function addClientSatisfaction(
  ticketId: string,
  clientId: string,
  rating: number,
  comment?: string
) {
  const [ticket] = await db
    .select({ id: tickets.id, clientId: tickets.clientId })
    .from(tickets)
    .where(and(eq(tickets.id, ticketId), eq(tickets.clientId, clientId)))
    .limit(1);

  if (!ticket) {
    throw new NotFoundError('Ticket');
  }

  const [updated] = await db
    .update(tickets)
    .set({
      satisfactionRating: rating,
      satisfactionComment: comment ?? null,
      updatedAt: new Date(),
    })
    .where(eq(tickets.id, ticketId))
    .returning();

  return updated;
}

// ============ SLA Definitions ============

export async function getSlaDefinitions() {
  return db
    .select()
    .from(slaDefinitions)
    .orderBy(asc(slaDefinitions.name));
}

export async function createSla(input: CreateSlaInput) {
  // If setting as default, unset any existing default
  if (input.isDefault) {
    await db
      .update(slaDefinitions)
      .set({ isDefault: false })
      .where(eq(slaDefinitions.isDefault, true));
  }

  const [sla] = await db
    .insert(slaDefinitions)
    .values({
      name: input.name,
      priority: input.priority as any,
      categoryId: input.categoryId,
      firstResponseMinutes: input.firstResponseMinutes,
      resolutionMinutes: input.resolutionMinutes,
      isDefault: input.isDefault ?? false,
    })
    .returning();

  return sla;
}

export async function updateSla(id: string, input: UpdateSlaInput) {
  const [existing] = await db
    .select({ id: slaDefinitions.id })
    .from(slaDefinitions)
    .where(eq(slaDefinitions.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Définition SLA');
  }

  // If setting as default, unset any existing default
  if (input.isDefault) {
    await db
      .update(slaDefinitions)
      .set({ isDefault: false })
      .where(eq(slaDefinitions.isDefault, true));
  }

  const [sla] = await db
    .update(slaDefinitions)
    .set(input as any)
    .where(eq(slaDefinitions.id, id))
    .returning();

  return sla;
}

export async function deleteSla(id: string) {
  const [existing] = await db
    .select({ id: slaDefinitions.id })
    .from(slaDefinitions)
    .where(eq(slaDefinitions.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Définition SLA');
  }

  await db.delete(slaDefinitions).where(eq(slaDefinitions.id, id));
}

// ============ Ticket Categories ============

export async function getTicketCategories() {
  return db
    .select()
    .from(ticketCategories)
    .where(eq(ticketCategories.isActive, true))
    .orderBy(asc(ticketCategories.sortOrder), asc(ticketCategories.name));
}

export async function createTicketCategory(input: {
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  sortOrder?: number;
}) {
  const [category] = await db
    .insert(ticketCategories)
    .values({
      name: input.name,
      slug: input.slug,
      description: input.description,
      parentId: input.parentId,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();

  return category;
}

export async function updateTicketCategory(
  id: string,
  input: {
    name?: string;
    slug?: string;
    description?: string;
    parentId?: string;
    sortOrder?: number;
  }
) {
  const [existing] = await db
    .select({ id: ticketCategories.id })
    .from(ticketCategories)
    .where(eq(ticketCategories.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Catégorie de ticket');
  }

  const [category] = await db
    .update(ticketCategories)
    .set(input)
    .where(eq(ticketCategories.id, id))
    .returning();

  return category;
}

export async function deleteTicketCategory(id: string) {
  const [existing] = await db
    .select({ id: ticketCategories.id })
    .from(ticketCategories)
    .where(eq(ticketCategories.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Catégorie de ticket');
  }

  // Soft delete by deactivating
  await db
    .update(ticketCategories)
    .set({ isActive: false })
    .where(eq(ticketCategories.id, id));
}

// ============ Canned Responses ============

export async function getCannedResponses() {
  return db
    .select()
    .from(cannedResponses)
    .where(eq(cannedResponses.isActive, true))
    .orderBy(asc(cannedResponses.title));
}

export async function createCannedResponse(input: {
  title: string;
  content: string;
  categoryId?: string;
  shortcut?: string;
}) {
  const [response] = await db
    .insert(cannedResponses)
    .values({
      title: input.title,
      content: input.content,
      categoryId: input.categoryId,
      shortcut: input.shortcut,
    })
    .returning();

  return response;
}

export async function updateCannedResponse(
  id: string,
  input: {
    title?: string;
    content?: string;
    categoryId?: string;
    shortcut?: string;
  }
) {
  const [existing] = await db
    .select({ id: cannedResponses.id })
    .from(cannedResponses)
    .where(eq(cannedResponses.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Réponse pré-enregistrée');
  }

  const [response] = await db
    .update(cannedResponses)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(cannedResponses.id, id))
    .returning();

  return response;
}

export async function deleteCannedResponse(id: string) {
  const [existing] = await db
    .select({ id: cannedResponses.id })
    .from(cannedResponses)
    .where(eq(cannedResponses.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Réponse pré-enregistrée');
  }

  // Soft delete by deactivating
  await db
    .update(cannedResponses)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(cannedResponses.id, id));
}

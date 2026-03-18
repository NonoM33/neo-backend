import { eq, ilike, or, count, and, SQL, gte, lte, desc, sql } from 'drizzle-orm';
import { db } from '../../config/database';
import { leads, leadStageHistory, activities, clients, projects } from '../../db/schema';
import { NotFoundError, ForbiddenError, ValidationError } from '../../lib/errors';
import { paginate, getOffset, type PaginationParams } from '../../lib/pagination';
import type {
  CreateLeadInput,
  UpdateLeadInput,
  ChangeStatusInput,
  ConvertLeadInput,
  LeadFilter,
} from './leads.schema';
import { isAdmin } from '../../middleware/rbac.middleware';
import type { JWTPayload } from '../../middleware/auth.middleware';

// Get leads with filters and pagination
export async function getLeads(
  params: PaginationParams,
  filters: LeadFilter,
  user: JWTPayload
) {
  const conditions: SQL[] = [];

  // Non-admins can only see their own leads
  if (!isAdmin(user)) {
    conditions.push(eq(leads.ownerId, user.userId));
  } else if (filters.ownerId) {
    conditions.push(eq(leads.ownerId, filters.ownerId));
  }

  if (filters.status) {
    conditions.push(eq(leads.status, filters.status));
  }

  if (filters.source) {
    conditions.push(eq(leads.source, filters.source));
  }

  if (filters.search) {
    conditions.push(
      or(
        ilike(leads.firstName, `%${filters.search}%`),
        ilike(leads.lastName, `%${filters.search}%`),
        ilike(leads.email, `%${filters.search}%`),
        ilike(leads.company, `%${filters.search}%`),
        ilike(leads.title, `%${filters.search}%`)
      )!
    );
  }

  if (filters.minValue !== undefined) {
    conditions.push(gte(leads.estimatedValue, filters.minValue.toString()));
  }

  if (filters.maxValue !== undefined) {
    conditions.push(lte(leads.estimatedValue, filters.maxValue.toString()));
  }

  if (filters.fromDate) {
    conditions.push(gte(leads.createdAt, filters.fromDate));
  }

  if (filters.toDate) {
    conditions.push(lte(leads.createdAt, filters.toDate));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db
      .select({
        id: leads.id,
        firstName: leads.firstName,
        lastName: leads.lastName,
        email: leads.email,
        phone: leads.phone,
        company: leads.company,
        title: leads.title,
        status: leads.status,
        source: leads.source,
        estimatedValue: leads.estimatedValue,
        probability: leads.probability,
        ownerId: leads.ownerId,
        city: leads.city,
        expectedCloseDate: leads.expectedCloseDate,
        createdAt: leads.createdAt,
        updatedAt: leads.updatedAt,
      })
      .from(leads)
      .where(where)
      .limit(params.limit)
      .offset(getOffset(params))
      .orderBy(desc(leads.updatedAt)),
    db.select({ total: count() }).from(leads).where(where),
  ]);

  const total = countResult[0]?.total ?? 0;
  return paginate(data, total, params);
}

// Get pipeline stats
export async function getLeadStats(user: JWTPayload) {
  const conditions: SQL[] = [];

  if (!isAdmin(user)) {
    conditions.push(eq(leads.ownerId, user.userId));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const stats = await db
    .select({
      status: leads.status,
      count: count(),
      totalValue: sql<string>`COALESCE(SUM(${leads.estimatedValue}), 0)`,
      weightedValue: sql<string>`COALESCE(SUM(${leads.estimatedValue} * ${leads.probability} / 100), 0)`,
    })
    .from(leads)
    .where(where)
    .groupBy(leads.status);

  return stats;
}

// Get lead by ID
export async function getLeadById(id: string, user: JWTPayload) {
  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, id))
    .limit(1);

  if (!lead) {
    throw new NotFoundError('Lead');
  }

  // Check access
  if (!isAdmin(user) && lead.ownerId !== user.userId) {
    throw new ForbiddenError('Accès non autorisé à ce lead');
  }

  // Get activities
  const leadActivities = await db
    .select()
    .from(activities)
    .where(eq(activities.leadId, id))
    .orderBy(desc(activities.createdAt))
    .limit(20);

  // Get stage history
  const history = await db
    .select()
    .from(leadStageHistory)
    .where(eq(leadStageHistory.leadId, id))
    .orderBy(desc(leadStageHistory.changedAt));

  return {
    ...lead,
    activities: leadActivities,
    stageHistory: history,
  };
}

// Create lead
export async function createLead(input: CreateLeadInput, user: JWTPayload) {
  const ownerId = input.ownerId || user.userId;

  // Non-admins can only create leads for themselves
  if (!isAdmin(user) && ownerId !== user.userId) {
    throw new ForbiddenError('Vous ne pouvez créer des leads que pour vous-même');
  }

  const [lead] = await db
    .insert(leads)
    .values({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email || null,
      phone: input.phone || null,
      company: input.company || null,
      title: input.title,
      description: input.description || null,
      status: input.status || 'prospect',
      source: input.source || 'autre',
      estimatedValue: input.estimatedValue?.toString() || null,
      probability: input.probability ?? 0,
      ownerId,
      address: input.address || null,
      city: input.city || null,
      postalCode: input.postalCode || null,
      surface: input.surface?.toString() || null,
      expectedCloseDate: input.expectedCloseDate || null,
    })
    .returning();

  if (!lead) {
    throw new Error('Failed to create lead');
  }

  // Log initial status
  await db.insert(leadStageHistory).values({
    leadId: lead.id,
    fromStatus: null,
    toStatus: lead.status,
    changedBy: user.userId,
    notes: 'Lead créé',
  });

  return lead;
}

// Update lead
export async function updateLead(id: string, input: UpdateLeadInput, user: JWTPayload) {
  const [existing] = await db
    .select({ id: leads.id, ownerId: leads.ownerId })
    .from(leads)
    .where(eq(leads.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Lead');
  }

  // Check access
  if (!isAdmin(user) && existing.ownerId !== user.userId) {
    throw new ForbiddenError('Accès non autorisé à ce lead');
  }

  // Prevent changing owner for non-admins
  if (!isAdmin(user) && input.ownerId && input.ownerId !== user.userId) {
    throw new ForbiddenError('Vous ne pouvez pas réassigner ce lead');
  }

  const updateData: Record<string, any> = {
    updatedAt: new Date(),
  };

  if (input.firstName !== undefined) updateData.firstName = input.firstName;
  if (input.lastName !== undefined) updateData.lastName = input.lastName;
  if (input.email !== undefined) updateData.email = input.email || null;
  if (input.phone !== undefined) updateData.phone = input.phone || null;
  if (input.company !== undefined) updateData.company = input.company || null;
  if (input.title !== undefined) updateData.title = input.title;
  if (input.description !== undefined) updateData.description = input.description || null;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.source !== undefined) updateData.source = input.source;
  if (input.estimatedValue !== undefined) updateData.estimatedValue = input.estimatedValue?.toString() || null;
  if (input.probability !== undefined) updateData.probability = input.probability;
  if (input.ownerId !== undefined) updateData.ownerId = input.ownerId;
  if (input.address !== undefined) updateData.address = input.address || null;
  if (input.city !== undefined) updateData.city = input.city || null;
  if (input.postalCode !== undefined) updateData.postalCode = input.postalCode || null;
  if (input.surface !== undefined) updateData.surface = input.surface?.toString() || null;
  if (input.expectedCloseDate !== undefined) updateData.expectedCloseDate = input.expectedCloseDate || null;

  const [lead] = await db
    .update(leads)
    .set(updateData)
    .where(eq(leads.id, id))
    .returning();

  return lead;
}

// Change lead status with history tracking
export async function changeLeadStatus(
  id: string,
  input: ChangeStatusInput,
  user: JWTPayload
) {
  const [existing] = await db
    .select({ id: leads.id, ownerId: leads.ownerId, status: leads.status })
    .from(leads)
    .where(eq(leads.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Lead');
  }

  // Check access
  if (!isAdmin(user) && existing.ownerId !== user.userId) {
    throw new ForbiddenError('Accès non autorisé à ce lead');
  }

  // Validate lost reason for perdu status
  if (input.status === 'perdu' && !input.lostReason) {
    throw new ValidationError('Raison de perte requise');
  }

  const updateData: any = {
    status: input.status,
    updatedAt: new Date(),
  };

  if (input.status === 'perdu') {
    updateData.lostReason = input.lostReason;
  }

  const [lead] = await db
    .update(leads)
    .set(updateData)
    .where(eq(leads.id, id))
    .returning();

  // Log status change
  await db.insert(leadStageHistory).values({
    leadId: id,
    fromStatus: existing.status,
    toStatus: input.status,
    changedBy: user.userId,
    notes: input.notes,
  });

  return lead;
}

// Convert lead to project
export async function convertLead(id: string, input: ConvertLeadInput, user: JWTPayload) {
  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, id))
    .limit(1);

  if (!lead) {
    throw new NotFoundError('Lead');
  }

  // Check access
  if (!isAdmin(user) && lead.ownerId !== user.userId) {
    throw new ForbiddenError('Accès non autorisé à ce lead');
  }

  // Check if already converted
  if (lead.convertedProjectId) {
    throw new ValidationError('Ce lead a déjà été converti en projet');
  }

  let clientId = lead.clientId;

  // Create client if needed
  if (!clientId && input.createClient) {
    const [newClient] = await db
      .insert(clients)
      .values({
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        address: lead.address,
        city: lead.city,
        postalCode: lead.postalCode,
      })
      .returning();
    if (!newClient) {
      throw new Error('Failed to create client');
    }
    clientId = newClient.id;
  }

  if (!clientId) {
    throw new ValidationError('Un client est requis pour créer un projet');
  }

  // Create project
  const projectName = input.projectName || lead.title;
  const [project] = await db
    .insert(projects)
    .values({
      clientId,
      userId: user.userId,
      name: projectName,
      description: lead.description,
      status: 'brouillon',
      address: lead.address,
      city: lead.city,
      postalCode: lead.postalCode,
      surface: lead.surface,
    })
    .returning();

  if (!project) {
    throw new Error('Failed to create project');
  }

  // Update lead status to 'gagne' if not already
  const convertUpdateData: any = {
    convertedProjectId: project.id,
    convertedAt: new Date(),
    updatedAt: new Date(),
  };

  if (lead.status !== 'gagne') {
    convertUpdateData.status = 'gagne';
  }

  await db.update(leads).set(convertUpdateData).where(eq(leads.id, id));

  // Log conversion in history
  if (lead.status !== 'gagne') {
    await db.insert(leadStageHistory).values({
      leadId: id,
      fromStatus: lead.status,
      toStatus: 'gagne',
      changedBy: user.userId,
      notes: `Converti en projet: ${projectName}`,
    });
  }

  // Transfer activities to project
  await db
    .update(activities)
    .set({ projectId: project.id })
    .where(eq(activities.leadId, id));

  return {
    lead: {
      ...lead,
      status: 'gagne' as const,
      convertedProjectId: project.id,
      convertedAt: new Date(),
    },
    project,
    clientId,
  };
}

// Delete lead
export async function deleteLead(id: string, user: JWTPayload) {
  const [existing] = await db
    .select({ id: leads.id, ownerId: leads.ownerId })
    .from(leads)
    .where(eq(leads.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Lead');
  }

  // Check access
  if (!isAdmin(user) && existing.ownerId !== user.userId) {
    throw new ForbiddenError('Accès non autorisé à ce lead');
  }

  await db.delete(leads).where(eq(leads.id, id));
}

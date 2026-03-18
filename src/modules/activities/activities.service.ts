import { eq, ilike, or, count, and, SQL, gte, lte, desc, lt } from 'drizzle-orm';
import { db } from '../../config/database';
import { activities } from '../../db/schema';
import { NotFoundError, ForbiddenError } from '../../lib/errors';
import { paginate, getOffset, type PaginationParams } from '../../lib/pagination';
import type {
  CreateActivityInput,
  UpdateActivityInput,
  CompleteActivityInput,
  ActivityFilter,
} from './activities.schema';
import { isAdmin } from '../../middleware/rbac.middleware';
import type { JWTPayload } from '../../middleware/auth.middleware';

// Get activities with filters and pagination
export async function getActivities(
  params: PaginationParams,
  filters: ActivityFilter,
  user: JWTPayload
) {
  const conditions: SQL[] = [];

  // Non-admins can only see their own activities
  if (!isAdmin(user)) {
    conditions.push(eq(activities.ownerId, user.userId));
  } else if (filters.ownerId) {
    conditions.push(eq(activities.ownerId, filters.ownerId));
  }

  if (filters.type) {
    conditions.push(eq(activities.type, filters.type));
  }

  if (filters.status) {
    conditions.push(eq(activities.status, filters.status));
  }

  if (filters.leadId) {
    conditions.push(eq(activities.leadId, filters.leadId));
  }

  if (filters.clientId) {
    conditions.push(eq(activities.clientId, filters.clientId));
  }

  if (filters.projectId) {
    conditions.push(eq(activities.projectId, filters.projectId));
  }

  if (filters.search) {
    conditions.push(
      or(
        ilike(activities.subject, `%${filters.search}%`),
        ilike(activities.description, `%${filters.search}%`)
      )!
    );
  }

  if (filters.fromDate) {
    conditions.push(gte(activities.scheduledAt, filters.fromDate));
  }

  if (filters.toDate) {
    conditions.push(lte(activities.scheduledAt, filters.toDate));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db
      .select({
        id: activities.id,
        leadId: activities.leadId,
        clientId: activities.clientId,
        projectId: activities.projectId,
        type: activities.type,
        subject: activities.subject,
        description: activities.description,
        status: activities.status,
        scheduledAt: activities.scheduledAt,
        completedAt: activities.completedAt,
        duration: activities.duration,
        reminderAt: activities.reminderAt,
        reminderSent: activities.reminderSent,
        ownerId: activities.ownerId,
        createdAt: activities.createdAt,
        updatedAt: activities.updatedAt,
      })
      .from(activities)
      .where(where)
      .limit(params.limit)
      .offset(getOffset(params))
      .orderBy(desc(activities.scheduledAt)),
    db.select({ total: count() }).from(activities).where(where),
  ]);

  const total = countResult[0]?.total ?? 0;
  return paginate(data, total, params);
}

// Get upcoming activities (scheduled and reminders)
export async function getUpcomingActivities(user: JWTPayload, days: number = 7) {
  const conditions: SQL[] = [];

  // Non-admins can only see their own activities
  if (!isAdmin(user)) {
    conditions.push(eq(activities.ownerId, user.userId));
  }

  // Only planned activities
  conditions.push(eq(activities.status, 'planifie'));

  // Within the next X days
  const now = new Date();
  const future = new Date();
  future.setDate(future.getDate() + days);

  conditions.push(gte(activities.scheduledAt, now));
  conditions.push(lte(activities.scheduledAt, future));

  const scheduled = await db
    .select()
    .from(activities)
    .where(and(...conditions))
    .orderBy(activities.scheduledAt)
    .limit(20);

  // Get pending reminders
  const reminderConditions: SQL[] = [];
  if (!isAdmin(user)) {
    reminderConditions.push(eq(activities.ownerId, user.userId));
  }
  reminderConditions.push(eq(activities.status, 'planifie'));
  reminderConditions.push(eq(activities.reminderSent, false));
  reminderConditions.push(lte(activities.reminderAt, future));
  reminderConditions.push(gte(activities.reminderAt, now));

  const reminders = await db
    .select()
    .from(activities)
    .where(and(...reminderConditions))
    .orderBy(activities.reminderAt)
    .limit(10);

  // Get overdue activities
  const overdueConditions: SQL[] = [];
  if (!isAdmin(user)) {
    overdueConditions.push(eq(activities.ownerId, user.userId));
  }
  overdueConditions.push(eq(activities.status, 'planifie'));
  overdueConditions.push(lt(activities.scheduledAt, now));

  const overdue = await db
    .select()
    .from(activities)
    .where(and(...overdueConditions))
    .orderBy(desc(activities.scheduledAt))
    .limit(10);

  return {
    scheduled,
    reminders,
    overdue,
  };
}

// Get activity by ID
export async function getActivityById(id: string, user: JWTPayload) {
  const [activity] = await db
    .select()
    .from(activities)
    .where(eq(activities.id, id))
    .limit(1);

  if (!activity) {
    throw new NotFoundError('Activité');
  }

  // Check access
  if (!isAdmin(user) && activity.ownerId !== user.userId) {
    throw new ForbiddenError('Accès non autorisé à cette activité');
  }

  return activity;
}

// Create activity
export async function createActivity(input: CreateActivityInput, user: JWTPayload) {
  const ownerId = input.ownerId || user.userId;

  // Non-admins can only create activities for themselves
  if (!isAdmin(user) && ownerId !== user.userId) {
    throw new ForbiddenError('Vous ne pouvez créer des activités que pour vous-même');
  }

  const [activity] = await db
    .insert(activities)
    .values({
      ...input,
      ownerId,
    })
    .returning();

  return activity;
}

// Update activity
export async function updateActivity(
  id: string,
  input: UpdateActivityInput,
  user: JWTPayload
) {
  const [existing] = await db
    .select({ id: activities.id, ownerId: activities.ownerId })
    .from(activities)
    .where(eq(activities.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Activité');
  }

  // Check access
  if (!isAdmin(user) && existing.ownerId !== user.userId) {
    throw new ForbiddenError('Accès non autorisé à cette activité');
  }

  // Prevent changing owner for non-admins
  if (!isAdmin(user) && input.ownerId && input.ownerId !== user.userId) {
    throw new ForbiddenError('Vous ne pouvez pas réassigner cette activité');
  }

  const [activity] = await db
    .update(activities)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(activities.id, id))
    .returning();

  return activity;
}

// Complete activity
export async function completeActivity(
  id: string,
  input: CompleteActivityInput,
  user: JWTPayload
) {
  const [existing] = await db
    .select({
      id: activities.id,
      ownerId: activities.ownerId,
      description: activities.description,
    })
    .from(activities)
    .where(eq(activities.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Activité');
  }

  // Check access
  if (!isAdmin(user) && existing.ownerId !== user.userId) {
    throw new ForbiddenError('Accès non autorisé à cette activité');
  }

  const updateData: any = {
    status: 'termine' as const,
    completedAt: new Date(),
    updatedAt: new Date(),
  };

  if (input.duration !== undefined) {
    updateData.duration = input.duration;
  }

  if (input.notes) {
    updateData.description = existing.description
      ? `${existing.description}\n\nNotes de clôture: ${input.notes}`
      : `Notes de clôture: ${input.notes}`;
  }

  const [activity] = await db
    .update(activities)
    .set(updateData)
    .where(eq(activities.id, id))
    .returning();

  return activity;
}

// Cancel activity
export async function cancelActivity(id: string, user: JWTPayload) {
  const [existing] = await db
    .select({ id: activities.id, ownerId: activities.ownerId })
    .from(activities)
    .where(eq(activities.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Activité');
  }

  // Check access
  if (!isAdmin(user) && existing.ownerId !== user.userId) {
    throw new ForbiddenError('Accès non autorisé à cette activité');
  }

  const [activity] = await db
    .update(activities)
    .set({
      status: 'annule' as const,
      updatedAt: new Date(),
    })
    .where(eq(activities.id, id))
    .returning();

  return activity;
}

// Delete activity
export async function deleteActivity(id: string, user: JWTPayload) {
  const [existing] = await db
    .select({ id: activities.id, ownerId: activities.ownerId })
    .from(activities)
    .where(eq(activities.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Activité');
  }

  // Check access
  if (!isAdmin(user) && existing.ownerId !== user.userId) {
    throw new ForbiddenError('Accès non autorisé à cette activité');
  }

  await db.delete(activities).where(eq(activities.id, id));
}

// Mark reminders as sent (called by a background job)
export async function markRemindersSent(activityIds: string[]) {
  if (activityIds.length === 0) return;

  await db
    .update(activities)
    .set({ reminderSent: true, updatedAt: new Date() })
    .where(
      or(...activityIds.map((id) => eq(activities.id, id)))!
    );
}

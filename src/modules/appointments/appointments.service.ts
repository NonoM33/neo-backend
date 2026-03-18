import { eq, and, or, gte, lte, desc, count, sql, ne, inArray, lt, gt } from 'drizzle-orm';
import { db } from '../../config/database';
import {
  appointments,
  appointmentParticipants,
  recurrenceRules,
  availabilitySlots,
  availabilityOverrides,
  appointmentTypeConfigs,
  appointmentTypeLabels,
} from '../../db/schema';
import { users } from '../../db/schema/users';
import { leads } from '../../db/schema/crm';
import { clients, projects } from '../../db/schema/projects';
import { NotFoundError, ForbiddenError, ValidationError, ConflictError } from '../../lib/errors';
import { paginate, getOffset, type PaginationParams } from '../../lib/pagination';
import { isAdmin } from '../../middleware/rbac.middleware';
import type { JWTPayload } from '../../middleware/auth.middleware';
import { checkConflicts } from './appointments.conflicts';
import { expandRecurrence } from './appointments.recurrence';
import type {
  CreateAppointmentInput,
  UpdateAppointmentInput,
  AppointmentFilter,
  CompleteAppointmentInput,
  CancelAppointmentInput,
  SetAvailabilityInput,
  AvailabilityOverrideInput,
  CreateRecurringInput,
  UpdateTypeConfigInput,
  AvailableSlotsQuery,
  UpdateAuditInput,
  DayOfWeek,
} from './appointments.schema';

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Check if user can access an appointment (organizer, participant, or admin).
 */
async function canAccessAppointment(appointmentId: string, user: JWTPayload): Promise<boolean> {
  if (isAdmin(user)) return true;

  const [appt] = await db
    .select({ organizerId: appointments.organizerId })
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .limit(1);

  if (!appt) return false;
  if (appt.organizerId === user.userId) return true;

  // Check if participant
  const [participant] = await db
    .select({ id: appointmentParticipants.id })
    .from(appointmentParticipants)
    .where(
      and(
        eq(appointmentParticipants.appointmentId, appointmentId),
        eq(appointmentParticipants.userId, user.userId)
      )
    )
    .limit(1);

  return !!participant;
}

/**
 * Generate auto-title from type and linked entity name.
 */
async function generateTitle(
  type: string,
  leadId?: string | null,
  clientId?: string | null
): Promise<string> {
  const typeLabel =
    appointmentTypeLabels[type as keyof typeof appointmentTypeLabels] || type;

  let entityName = '';

  if (leadId) {
    const [lead] = await db
      .select({ firstName: leads.firstName, lastName: leads.lastName })
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);
    if (lead) {
      entityName = `${lead.firstName} ${lead.lastName}`;
    }
  } else if (clientId) {
    const [client] = await db
      .select({ firstName: clients.firstName, lastName: clients.lastName })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);
    if (client) {
      entityName = `${client.firstName} ${client.lastName}`;
    }
  }

  return entityName ? `${typeLabel} - ${entityName}` : typeLabel;
}

// Day-of-week to JS getDay() index map
const DAY_INDEX_MAP: Record<DayOfWeek, number> = {
  dimanche: 0,
  lundi: 1,
  mardi: 2,
  mercredi: 3,
  jeudi: 4,
  vendredi: 5,
  samedi: 6,
};

const JS_DAY_TO_ENUM: Record<number, DayOfWeek> = {
  0: 'dimanche',
  1: 'lundi',
  2: 'mardi',
  3: 'mercredi',
  4: 'jeudi',
  5: 'vendredi',
  6: 'samedi',
};

// ─── Appointments CRUD ─────────────────────────────────────────────────────

/**
 * List appointments with date range filter (required) and optional filters.
 * RBAC: admin sees all, others see their own + participating.
 */
export async function getAppointments(
  params: PaginationParams,
  filters: AppointmentFilter,
  user: JWTPayload
) {
  const conditions: any[] = [
    gte(appointments.scheduledAt, filters.fromDate),
    lte(appointments.scheduledAt, filters.toDate),
  ];

  if (filters.type) {
    conditions.push(eq(appointments.type, filters.type));
  }
  if (filters.status) {
    conditions.push(eq(appointments.status, filters.status));
  }
  if (filters.leadId) {
    conditions.push(eq(appointments.leadId, filters.leadId));
  }
  if (filters.clientId) {
    conditions.push(eq(appointments.clientId, filters.clientId));
  }
  if (filters.projectId) {
    conditions.push(eq(appointments.projectId, filters.projectId));
  }

  // RBAC: non-admin sees only own + participating
  if (!isAdmin(user)) {
    const targetUserId = filters.userId || user.userId;

    // Get IDs of appointments where user is participant
    const participatingIds = await db
      .select({ appointmentId: appointmentParticipants.appointmentId })
      .from(appointmentParticipants)
      .where(eq(appointmentParticipants.userId, targetUserId));

    const participatingAppointmentIds = participatingIds.map((p) => p.appointmentId);

    if (participatingAppointmentIds.length > 0) {
      conditions.push(
        or(
          eq(appointments.organizerId, targetUserId),
          inArray(appointments.id, participatingAppointmentIds)
        )
      );
    } else {
      conditions.push(eq(appointments.organizerId, targetUserId));
    }
  } else if (filters.userId) {
    // Admin filtering by specific user
    const participatingIds = await db
      .select({ appointmentId: appointmentParticipants.appointmentId })
      .from(appointmentParticipants)
      .where(eq(appointmentParticipants.userId, filters.userId));

    const participatingAppointmentIds = participatingIds.map((p) => p.appointmentId);

    if (participatingAppointmentIds.length > 0) {
      conditions.push(
        or(
          eq(appointments.organizerId, filters.userId),
          inArray(appointments.id, participatingAppointmentIds)
        )
      );
    } else {
      conditions.push(eq(appointments.organizerId, filters.userId));
    }
  }

  const where = and(...conditions);

  const [data, countResult] = await Promise.all([
    db
      .select({
        id: appointments.id,
        title: appointments.title,
        type: appointments.type,
        status: appointments.status,
        scheduledAt: appointments.scheduledAt,
        endAt: appointments.endAt,
        duration: appointments.duration,
        location: appointments.location,
        locationType: appointments.locationType,
        organizerId: appointments.organizerId,
        leadId: appointments.leadId,
        clientId: appointments.clientId,
        projectId: appointments.projectId,
        recurrenceParentId: appointments.recurrenceParentId,
        notes: appointments.notes,
        createdAt: appointments.createdAt,
        updatedAt: appointments.updatedAt,
      })
      .from(appointments)
      .where(where)
      .limit(params.limit)
      .offset(getOffset(params))
      .orderBy(desc(appointments.scheduledAt)),
    db.select({ total: count() }).from(appointments).where(where),
  ]);

  const total = countResult[0]?.total ?? 0;
  return paginate(data, total, params);
}

/**
 * Get appointment by ID with participants.
 */
export async function getAppointmentById(id: string, user: JWTPayload) {
  const [appointment] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, id))
    .limit(1);

  if (!appointment) {
    throw new NotFoundError('Rendez-vous');
  }

  // Check access
  const hasAccess = await canAccessAppointment(id, user);
  if (!hasAccess) {
    throw new ForbiddenError('Accès non autorisé à ce rendez-vous');
  }

  // Get participants with user info
  const participants = await db
    .select({
      id: appointmentParticipants.id,
      userId: appointmentParticipants.userId,
      role: appointmentParticipants.role,
      status: appointmentParticipants.status,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
    })
    .from(appointmentParticipants)
    .innerJoin(users, eq(appointmentParticipants.userId, users.id))
    .where(eq(appointmentParticipants.appointmentId, id));

  // Get organizer info
  const [organizer] = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, appointment.organizerId))
    .limit(1);

  return {
    ...appointment,
    organizer,
    participants,
  };
}

/**
 * Create a new appointment.
 * Auto-generates title if not provided.
 * Checks for scheduling conflicts.
 * Inserts participants if provided.
 */
export async function createAppointment(input: CreateAppointmentInput, user: JWTPayload) {
  const organizerId = input.organizerId || user.userId;

  // Non-admins can only organize for themselves
  if (!isAdmin(user) && organizerId !== user.userId) {
    throw new ForbiddenError('Vous ne pouvez organiser des rendez-vous que pour vous-même');
  }

  // Generate title if not provided
  const title =
    input.title || (await generateTitle(input.type, input.leadId, input.clientId));

  // Collect all user IDs to check for conflicts (organizer + participants)
  const allUserIds = [organizerId];
  if (input.participants) {
    for (const p of input.participants) {
      if (!allUserIds.includes(p.userId)) {
        allUserIds.push(p.userId);
      }
    }
  }

  // Check conflicts
  const conflicts = await checkConflicts(input.scheduledAt, input.endAt, allUserIds);
  if (conflicts.length > 0) {
    const conflictUserIds = [...new Set(conflicts.map((c) => c.userId))];
    // Fetch user names for a better error message
    const conflictUsers = await db
      .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(inArray(users.id, conflictUserIds));

    const names = conflictUsers.map((u) => `${u.firstName} ${u.lastName}`).join(', ');
    throw new ConflictError(`Conflit de planning pour: ${names}`);
  }

  // Insert appointment
  const [appointment] = await db
    .insert(appointments)
    .values({
      title,
      type: input.type,
      status: 'propose',
      scheduledAt: input.scheduledAt,
      endAt: input.endAt,
      duration: input.duration,
      location: input.location || null,
      locationType: input.locationType || 'sur_site',
      organizerId,
      leadId: input.leadId || null,
      clientId: input.clientId || null,
      projectId: input.projectId || null,
      notes: input.notes || null,
      metadata: input.metadata || null,
    })
    .returning();

  if (!appointment) {
    throw new Error('Échec de la création du rendez-vous');
  }

  // Insert participants
  if (input.participants && input.participants.length > 0) {
    await db.insert(appointmentParticipants).values(
      input.participants.map((p) => ({
        appointmentId: appointment.id,
        userId: p.userId,
        role: p.role || 'participant',
        status: 'en_attente' as const,
      }))
    );
  }

  return appointment;
}

/**
 * Update an existing appointment.
 */
export async function updateAppointment(
  id: string,
  input: UpdateAppointmentInput,
  user: JWTPayload
) {
  const [existing] = await db
    .select({ id: appointments.id, organizerId: appointments.organizerId, status: appointments.status })
    .from(appointments)
    .where(eq(appointments.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Rendez-vous');
  }

  // Only organizer or admin can update
  if (!isAdmin(user) && existing.organizerId !== user.userId) {
    throw new ForbiddenError('Seul l\'organisateur peut modifier ce rendez-vous');
  }

  if (existing.status === 'termine') {
    throw new ValidationError('Impossible de modifier un rendez-vous terminé');
  }

  // If rescheduling, check conflicts
  if (input.scheduledAt && input.endAt) {
    const allUserIds = [existing.organizerId];

    // Get existing participants
    const existingParticipants = await db
      .select({ userId: appointmentParticipants.userId })
      .from(appointmentParticipants)
      .where(eq(appointmentParticipants.appointmentId, id));

    for (const p of existingParticipants) {
      if (!allUserIds.includes(p.userId)) {
        allUserIds.push(p.userId);
      }
    }

    const conflicts = await checkConflicts(input.scheduledAt, input.endAt, allUserIds, id);
    if (conflicts.length > 0) {
      const conflictUserIds = [...new Set(conflicts.map((c) => c.userId))];
      const conflictUsers = await db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(inArray(users.id, conflictUserIds));

      const names = conflictUsers.map((u) => `${u.firstName} ${u.lastName}`).join(', ');
      throw new ConflictError(`Conflit de planning pour: ${names}`);
    }
  }

  const updateData: Record<string, any> = {
    updatedAt: new Date(),
  };

  if (input.title !== undefined) updateData.title = input.title;
  if (input.type !== undefined) updateData.type = input.type;
  if (input.scheduledAt !== undefined) updateData.scheduledAt = input.scheduledAt;
  if (input.endAt !== undefined) updateData.endAt = input.endAt;
  if (input.duration !== undefined) updateData.duration = input.duration;
  if (input.location !== undefined) updateData.location = input.location || null;
  if (input.locationType !== undefined) updateData.locationType = input.locationType;
  if (input.organizerId !== undefined) updateData.organizerId = input.organizerId;
  if (input.leadId !== undefined) updateData.leadId = input.leadId || null;
  if (input.clientId !== undefined) updateData.clientId = input.clientId || null;
  if (input.projectId !== undefined) updateData.projectId = input.projectId || null;
  if (input.notes !== undefined) updateData.notes = input.notes || null;
  if (input.metadata !== undefined) updateData.metadata = input.metadata || null;

  const [updated] = await db
    .update(appointments)
    .set(updateData)
    .where(eq(appointments.id, id))
    .returning();

  return updated;
}

/**
 * Delete an appointment.
 */
export async function deleteAppointment(id: string, user: JWTPayload) {
  const [existing] = await db
    .select({ id: appointments.id, organizerId: appointments.organizerId })
    .from(appointments)
    .where(eq(appointments.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Rendez-vous');
  }

  if (!isAdmin(user) && existing.organizerId !== user.userId) {
    throw new ForbiddenError('Seul l\'organisateur peut supprimer ce rendez-vous');
  }

  await db.delete(appointments).where(eq(appointments.id, id));
}

// ─── Status Transitions ────────────────────────────────────────────────────

/**
 * Confirm an appointment (propose -> confirme).
 */
export async function confirmAppointment(id: string, user: JWTPayload) {
  const [existing] = await db
    .select({ id: appointments.id, organizerId: appointments.organizerId, status: appointments.status })
    .from(appointments)
    .where(eq(appointments.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Rendez-vous');
  }

  if (!isAdmin(user) && existing.organizerId !== user.userId) {
    throw new ForbiddenError('Seul l\'organisateur peut confirmer ce rendez-vous');
  }

  if (existing.status !== 'propose') {
    throw new ValidationError('Seul un rendez-vous proposé peut être confirmé');
  }

  const [updated] = await db
    .update(appointments)
    .set({ status: 'confirme', updatedAt: new Date() })
    .where(eq(appointments.id, id))
    .returning();

  return updated;
}

/**
 * Start an appointment (confirme -> en_cours).
 */
export async function startAppointment(id: string, user: JWTPayload) {
  const [existing] = await db
    .select({ id: appointments.id, organizerId: appointments.organizerId, status: appointments.status })
    .from(appointments)
    .where(eq(appointments.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Rendez-vous');
  }

  if (!isAdmin(user) && existing.organizerId !== user.userId) {
    throw new ForbiddenError('Seul l\'organisateur peut démarrer ce rendez-vous');
  }

  if (existing.status !== 'confirme') {
    throw new ValidationError('Seul un rendez-vous confirmé peut être démarré');
  }

  const [updated] = await db
    .update(appointments)
    .set({ status: 'en_cours', updatedAt: new Date() })
    .where(eq(appointments.id, id))
    .returning();

  return updated;
}

/**
 * Complete an appointment (en_cours -> termine).
 */
export async function completeAppointment(
  id: string,
  input: CompleteAppointmentInput,
  user: JWTPayload
) {
  const [existing] = await db
    .select({
      id: appointments.id,
      organizerId: appointments.organizerId,
      status: appointments.status,
      duration: appointments.duration,
    })
    .from(appointments)
    .where(eq(appointments.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Rendez-vous');
  }

  if (!isAdmin(user) && existing.organizerId !== user.userId) {
    throw new ForbiddenError('Seul l\'organisateur peut terminer ce rendez-vous');
  }

  if (existing.status !== 'en_cours') {
    throw new ValidationError('Seul un rendez-vous en cours peut être terminé');
  }

  const updateData: Record<string, any> = {
    status: 'termine',
    updatedAt: new Date(),
  };

  if (input.outcome !== undefined) updateData.outcome = input.outcome;
  if (input.actualDuration !== undefined) updateData.duration = input.actualDuration;

  const [updated] = await db
    .update(appointments)
    .set(updateData)
    .where(eq(appointments.id, id))
    .returning();

  return updated;
}

/**
 * Update audit data in appointment metadata (deep-merge).
 * Only allowed when appointment status is en_cours.
 */
export async function updateAuditData(
  id: string,
  auditData: UpdateAuditInput,
  user: JWTPayload
) {
  const [existing] = await db
    .select({
      id: appointments.id,
      organizerId: appointments.organizerId,
      status: appointments.status,
      metadata: appointments.metadata,
    })
    .from(appointments)
    .where(eq(appointments.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Rendez-vous');
  }

  if (!isAdmin(user) && existing.organizerId !== user.userId) {
    throw new ForbiddenError('Seul l\'organisateur peut modifier l\'audit');
  }

  if (existing.status !== 'en_cours') {
    throw new ValidationError('L\'audit ne peut être modifié que pour un rendez-vous en cours');
  }

  // Deep-merge audit data into metadata
  const currentMetadata = (existing.metadata as Record<string, any>) || {};
  const currentAudit = currentMetadata.audit || {};

  const mergedAudit: Record<string, any> = { ...currentAudit };

  if (auditData.startedAt !== undefined) {
    mergedAudit.startedAt = auditData.startedAt;
  }
  if (auditData.currentSection !== undefined) {
    mergedAudit.currentSection = auditData.currentSection;
  }

  // Deep-merge sections at item level
  if (auditData.sections) {
    const existingSections = mergedAudit.sections || {};
    for (const [sectionId, sectionData] of Object.entries(auditData.sections)) {
      const existingSection = existingSections[sectionId] || {};
      existingSections[sectionId] = {
        ...existingSection,
        items: { ...(existingSection.items || {}), ...(sectionData.items || {}) },
        notes: sectionData.notes !== undefined ? sectionData.notes : existingSection.notes,
      };
    }
    mergedAudit.sections = existingSections;
  }

  const newMetadata = { ...currentMetadata, audit: mergedAudit };

  const [updated] = await db
    .update(appointments)
    .set({ metadata: newMetadata, updatedAt: new Date() })
    .where(eq(appointments.id, id))
    .returning();

  return updated;
}

/**
 * Cancel an appointment (any status except termine -> annule).
 */
export async function cancelAppointment(
  id: string,
  input: CancelAppointmentInput,
  user: JWTPayload
) {
  const [existing] = await db
    .select({ id: appointments.id, organizerId: appointments.organizerId, status: appointments.status })
    .from(appointments)
    .where(eq(appointments.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Rendez-vous');
  }

  if (!isAdmin(user) && existing.organizerId !== user.userId) {
    throw new ForbiddenError('Seul l\'organisateur peut annuler ce rendez-vous');
  }

  if (existing.status === 'termine') {
    throw new ValidationError('Impossible d\'annuler un rendez-vous terminé');
  }

  if (existing.status === 'annule') {
    throw new ValidationError('Ce rendez-vous est déjà annulé');
  }

  const [updated] = await db
    .update(appointments)
    .set({
      status: 'annule',
      cancellationReason: input.reason,
      updatedAt: new Date(),
    })
    .where(eq(appointments.id, id))
    .returning();

  return updated;
}

/**
 * Mark appointment as no-show (confirme -> no_show).
 */
export async function markNoShow(id: string, user: JWTPayload) {
  const [existing] = await db
    .select({ id: appointments.id, organizerId: appointments.organizerId, status: appointments.status })
    .from(appointments)
    .where(eq(appointments.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Rendez-vous');
  }

  if (!isAdmin(user) && existing.organizerId !== user.userId) {
    throw new ForbiddenError('Seul l\'organisateur peut marquer un no-show');
  }

  if (existing.status !== 'confirme') {
    throw new ValidationError('Seul un rendez-vous confirmé peut être marqué no-show');
  }

  const [updated] = await db
    .update(appointments)
    .set({ status: 'no_show', updatedAt: new Date() })
    .where(eq(appointments.id, id))
    .returning();

  return updated;
}

// ─── Participants ───────────────────────────────────────────────────────────

/**
 * Add a participant to an appointment.
 */
export async function addParticipant(
  appointmentId: string,
  userId: string,
  role: string,
  user: JWTPayload
) {
  const [existing] = await db
    .select({ id: appointments.id, organizerId: appointments.organizerId })
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Rendez-vous');
  }

  if (!isAdmin(user) && existing.organizerId !== user.userId) {
    throw new ForbiddenError('Seul l\'organisateur peut ajouter des participants');
  }

  // Check if user already a participant
  const [existingParticipant] = await db
    .select({ id: appointmentParticipants.id })
    .from(appointmentParticipants)
    .where(
      and(
        eq(appointmentParticipants.appointmentId, appointmentId),
        eq(appointmentParticipants.userId, userId)
      )
    )
    .limit(1);

  if (existingParticipant) {
    throw new ValidationError('Cet utilisateur est déjà participant');
  }

  // Check for conflicts for the new participant
  const [appt] = await db
    .select({ scheduledAt: appointments.scheduledAt, endAt: appointments.endAt })
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .limit(1);

  if (appt) {
    const conflicts = await checkConflicts(appt.scheduledAt, appt.endAt, [userId], appointmentId);
    if (conflicts.length > 0) {
      const [conflictUser] = await db
        .select({ firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      const name = conflictUser ? `${conflictUser.firstName} ${conflictUser.lastName}` : userId;
      throw new ConflictError(`Conflit de planning pour: ${name}`);
    }
  }

  const [participant] = await db
    .insert(appointmentParticipants)
    .values({
      appointmentId,
      userId,
      role: role as any,
      status: 'en_attente',
    })
    .returning();

  return participant;
}

/**
 * Remove a participant from an appointment.
 */
export async function removeParticipant(
  appointmentId: string,
  userId: string,
  user: JWTPayload
) {
  const [existing] = await db
    .select({ id: appointments.id, organizerId: appointments.organizerId })
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Rendez-vous');
  }

  // Organizer, admin, or the participant themselves can remove
  if (!isAdmin(user) && existing.organizerId !== user.userId && userId !== user.userId) {
    throw new ForbiddenError('Accès non autorisé');
  }

  const result = await db
    .delete(appointmentParticipants)
    .where(
      and(
        eq(appointmentParticipants.appointmentId, appointmentId),
        eq(appointmentParticipants.userId, userId)
      )
    )
    .returning();

  if (result.length === 0) {
    throw new NotFoundError('Participant');
  }
}

/**
 * Respond to an invitation (accept or refuse).
 */
export async function respondToInvitation(
  appointmentId: string,
  userId: string,
  status: 'accepte' | 'refuse'
) {
  const [existing] = await db
    .select({ id: appointmentParticipants.id })
    .from(appointmentParticipants)
    .where(
      and(
        eq(appointmentParticipants.appointmentId, appointmentId),
        eq(appointmentParticipants.userId, userId)
      )
    )
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Invitation');
  }

  const [updated] = await db
    .update(appointmentParticipants)
    .set({ status })
    .where(eq(appointmentParticipants.id, existing.id))
    .returning();

  return updated;
}

// ─── Availability ───────────────────────────────────────────────────────────

/**
 * Get availability slots for a user.
 */
export async function getAvailability(userId: string) {
  const slots = await db
    .select()
    .from(availabilitySlots)
    .where(eq(availabilitySlots.userId, userId))
    .orderBy(availabilitySlots.dayOfWeek, availabilitySlots.startTime);

  const overrides = await db
    .select()
    .from(availabilityOverrides)
    .where(eq(availabilityOverrides.userId, userId))
    .orderBy(desc(availabilityOverrides.date));

  return { slots, overrides };
}

/**
 * Set availability slots for a user (bulk replace).
 */
export async function setAvailability(userId: string, input: SetAvailabilityInput) {
  // Delete all existing slots for the user
  await db
    .delete(availabilitySlots)
    .where(eq(availabilitySlots.userId, userId));

  if (input.slots.length === 0) {
    return [];
  }

  // Insert new slots
  const newSlots = await db
    .insert(availabilitySlots)
    .values(
      input.slots.map((s) => ({
        userId,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        isActive: s.isActive ?? true,
      }))
    )
    .returning();

  return newSlots;
}

/**
 * Get available time slots for a user within a date range and for a given duration.
 * Cross-references availability_slots, availability_overrides, and existing appointments.
 */
export async function getAvailableSlots(
  userId: string,
  fromDate: Date,
  toDate: Date,
  duration: number
) {
  // Get user's regular availability slots
  const slots = await db
    .select()
    .from(availabilitySlots)
    .where(and(eq(availabilitySlots.userId, userId), eq(availabilitySlots.isActive, true)));

  // Get overrides for the date range
  const overrides = await db
    .select()
    .from(availabilityOverrides)
    .where(
      and(
        eq(availabilityOverrides.userId, userId),
        gte(availabilityOverrides.date, fromDate),
        lte(availabilityOverrides.date, toDate)
      )
    );

  // Get existing appointments for this user in the range (as organizer or participant)
  const participatingIds = await db
    .select({ appointmentId: appointmentParticipants.appointmentId })
    .from(appointmentParticipants)
    .where(eq(appointmentParticipants.userId, userId));

  const participatingAppointmentIds = participatingIds.map((p) => p.appointmentId);

  let existingAppointmentsConditions: any;
  if (participatingAppointmentIds.length > 0) {
    existingAppointmentsConditions = and(
      gte(appointments.scheduledAt, fromDate),
      lte(appointments.endAt, toDate),
      or(
        eq(appointments.organizerId, userId),
        inArray(appointments.id, participatingAppointmentIds)
      ),
      ne(appointments.status, 'annule'),
      ne(appointments.status, 'no_show')
    );
  } else {
    existingAppointmentsConditions = and(
      gte(appointments.scheduledAt, fromDate),
      lte(appointments.endAt, toDate),
      eq(appointments.organizerId, userId),
      ne(appointments.status, 'annule'),
      ne(appointments.status, 'no_show')
    );
  }

  const existingAppointments = await db
    .select({
      scheduledAt: appointments.scheduledAt,
      endAt: appointments.endAt,
    })
    .from(appointments)
    .where(existingAppointmentsConditions);

  // Build override map: date string -> override
  const overrideMap = new Map<string, (typeof overrides)[number]>();
  for (const override of overrides) {
    const dateKey = override.date.toISOString().split('T')[0];
    overrideMap.set(dateKey!, override);
  }

  // Build slot map: dayOfWeek -> slots
  const slotMap = new Map<string, (typeof slots)[number][]>();
  for (const slot of slots) {
    const existing = slotMap.get(slot.dayOfWeek) || [];
    existing.push(slot);
    slotMap.set(slot.dayOfWeek, existing);
  }

  const availableSlots: Array<{ date: string; startTime: string; endTime: string }> = [];

  // Iterate each day in the range
  const current = new Date(fromDate);
  while (current <= toDate) {
    const dateStr = current.toISOString().split('T')[0]!;
    const dayOfWeek = JS_DAY_TO_ENUM[current.getDay()]!;
    const override = overrideMap.get(dateStr);

    let daySlots: Array<{ start: string; end: string }> = [];

    if (override) {
      if (override.isAvailable && override.startTime && override.endTime) {
        daySlots = [{ start: override.startTime, end: override.endTime }];
      }
      // If override says not available, daySlots stays empty
    } else {
      // Use regular availability
      const regularSlots = slotMap.get(dayOfWeek) || [];
      daySlots = regularSlots.map((s) => ({ start: s.startTime, end: s.endTime }));
    }

    // For each availability window, subtract existing appointments and find free slots
    for (const slot of daySlots) {
      const slotStartMinutes = parseTime(slot.start);
      const slotEndMinutes = parseTime(slot.end);

      // Find appointments on this day that overlap this slot
      const dayAppointments = existingAppointments
        .filter((a) => {
          const apptDate = a.scheduledAt.toISOString().split('T')[0];
          return apptDate === dateStr;
        })
        .map((a) => ({
          start: a.scheduledAt.getHours() * 60 + a.scheduledAt.getMinutes(),
          end: a.endAt.getHours() * 60 + a.endAt.getMinutes(),
        }))
        .sort((a, b) => a.start - b.start);

      // Find free windows within this slot
      let windowStart = slotStartMinutes;

      for (const appt of dayAppointments) {
        if (appt.start > windowStart) {
          // There's a gap before this appointment
          const gapEnd = Math.min(appt.start, slotEndMinutes);
          if (gapEnd - windowStart >= duration) {
            // Generate slots in this gap
            let slotStart = windowStart;
            while (slotStart + duration <= gapEnd) {
              availableSlots.push({
                date: dateStr,
                startTime: formatTime(slotStart),
                endTime: formatTime(slotStart + duration),
              });
              slotStart += 30; // 30-minute increments
            }
          }
        }
        windowStart = Math.max(windowStart, appt.end);
      }

      // Check gap after last appointment
      if (windowStart + duration <= slotEndMinutes) {
        let slotStart = windowStart;
        while (slotStart + duration <= slotEndMinutes) {
          availableSlots.push({
            date: dateStr,
            startTime: formatTime(slotStart),
            endTime: formatTime(slotStart + duration),
          });
          slotStart += 30; // 30-minute increments
        }
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return availableSlots;
}

/**
 * Add an availability override.
 */
export async function addAvailabilityOverride(
  userId: string,
  input: AvailabilityOverrideInput
) {
  const [override] = await db
    .insert(availabilityOverrides)
    .values({
      userId,
      date: input.date,
      isAvailable: input.isAvailable,
      startTime: input.startTime || null,
      endTime: input.endTime || null,
      reason: input.reason || null,
    })
    .returning();

  return override;
}

/**
 * Delete an availability override.
 */
export async function deleteAvailabilityOverride(id: string, userId: string) {
  const [existing] = await db
    .select({ id: availabilityOverrides.id, userId: availabilityOverrides.userId })
    .from(availabilityOverrides)
    .where(eq(availabilityOverrides.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Exception de disponibilité');
  }

  if (existing.userId !== userId) {
    throw new ForbiddenError('Accès non autorisé');
  }

  await db.delete(availabilityOverrides).where(eq(availabilityOverrides.id, id));
}

// ─── Type Configs ───────────────────────────────────────────────────────────

/**
 * Get all appointment type configs.
 */
export async function getTypeConfigs() {
  const configs = await db
    .select()
    .from(appointmentTypeConfigs)
    .orderBy(appointmentTypeConfigs.type);

  return configs;
}

/**
 * Update an appointment type config (admin only).
 */
export async function updateTypeConfig(
  type: string,
  input: UpdateTypeConfigInput,
  user: JWTPayload
) {
  if (!isAdmin(user)) {
    throw new ForbiddenError('Seul un administrateur peut modifier les configurations');
  }

  const [existing] = await db
    .select({ id: appointmentTypeConfigs.id })
    .from(appointmentTypeConfigs)
    .where(eq(appointmentTypeConfigs.type, type as any))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Configuration de type');
  }

  const updateData: Record<string, any> = {};

  if (input.label !== undefined) updateData.label = input.label;
  if (input.defaultDuration !== undefined) updateData.defaultDuration = input.defaultDuration;
  if (input.color !== undefined) updateData.color = input.color;
  if (input.icon !== undefined) updateData.icon = input.icon;
  if (input.allowedRoles !== undefined) updateData.allowedRoles = input.allowedRoles;
  if (input.requiresClient !== undefined) updateData.requiresClient = input.requiresClient;
  if (input.requiresLocation !== undefined) updateData.requiresLocation = input.requiresLocation;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;

  const [updated] = await db
    .update(appointmentTypeConfigs)
    .set(updateData)
    .where(eq(appointmentTypeConfigs.id, existing.id))
    .returning();

  return updated;
}

// ─── Recurring Appointments ─────────────────────────────────────────────────

/**
 * Create a recurring appointment series.
 * Creates the recurrence rule, expands occurrences, and inserts each one.
 */
export async function createRecurringAppointment(
  input: CreateRecurringInput,
  user: JWTPayload
) {
  const organizerId = input.organizerId || user.userId;

  if (!isAdmin(user) && organizerId !== user.userId) {
    throw new ForbiddenError('Vous ne pouvez organiser des rendez-vous que pour vous-même');
  }

  // Create recurrence rule
  const [rule] = await db
    .insert(recurrenceRules)
    .values({
      frequency: input.recurrence.frequency,
      interval: input.recurrence.interval || 1,
      daysOfWeek: input.recurrence.daysOfWeek || null,
      endDate: input.recurrence.endDate || null,
      maxOccurrences: input.recurrence.maxOccurrences || null,
    })
    .returning();

  if (!rule) {
    throw new Error('Échec de la création de la règle de récurrence');
  }

  // Expand occurrences
  const occurrenceDates = expandRecurrence(rule, input.scheduledAt);

  if (occurrenceDates.length === 0) {
    throw new ValidationError('La règle de récurrence ne génère aucune occurrence');
  }

  // Generate title
  const title =
    input.title || (await generateTitle(input.type, input.leadId, input.clientId));

  // Create the first appointment (parent)
  const durationMs = input.duration * 60 * 1000;
  const firstDate = occurrenceDates[0]!;
  const firstEndAt = new Date(firstDate.getTime() + durationMs);

  const [parentAppointment] = await db
    .insert(appointments)
    .values({
      title,
      type: input.type,
      status: 'propose',
      scheduledAt: firstDate,
      endAt: firstEndAt,
      duration: input.duration,
      location: input.location || null,
      locationType: input.locationType || 'sur_site',
      organizerId,
      leadId: input.leadId || null,
      clientId: input.clientId || null,
      projectId: input.projectId || null,
      recurrenceRuleId: rule.id,
      recurrenceParentId: null, // This IS the parent
      notes: input.notes || null,
      metadata: input.metadata || null,
    })
    .returning();

  if (!parentAppointment) {
    throw new Error('Échec de la création du rendez-vous parent');
  }

  // Insert participants for parent
  if (input.participants && input.participants.length > 0) {
    await db.insert(appointmentParticipants).values(
      input.participants.map((p) => ({
        appointmentId: parentAppointment.id,
        userId: p.userId,
        role: p.role || 'participant',
        status: 'en_attente' as const,
      }))
    );
  }

  // Create remaining occurrences (children)
  const childAppointments = [];
  for (let i = 1; i < occurrenceDates.length; i++) {
    const date = occurrenceDates[i]!;
    const endAt = new Date(date.getTime() + durationMs);

    const [child] = await db
      .insert(appointments)
      .values({
        title,
        type: input.type,
        status: 'propose',
        scheduledAt: date,
        endAt,
        duration: input.duration,
        location: input.location || null,
        locationType: input.locationType || 'sur_site',
        organizerId,
        leadId: input.leadId || null,
        clientId: input.clientId || null,
        projectId: input.projectId || null,
        recurrenceRuleId: rule.id,
        recurrenceParentId: parentAppointment.id,
        notes: input.notes || null,
        metadata: input.metadata || null,
      })
      .returning();

    if (child) {
      childAppointments.push(child);

      // Insert participants for each child
      if (input.participants && input.participants.length > 0) {
        await db.insert(appointmentParticipants).values(
          input.participants.map((p) => ({
            appointmentId: child.id,
            userId: p.userId,
            role: p.role || 'participant',
            status: 'en_attente' as const,
          }))
        );
      }
    }
  }

  return {
    rule,
    parent: parentAppointment,
    occurrences: [parentAppointment, ...childAppointments],
    totalCreated: 1 + childAppointments.length,
  };
}

/**
 * Update a single occurrence (detach from series if needed).
 */
export async function updateSingleOccurrence(
  id: string,
  input: UpdateAppointmentInput,
  user: JWTPayload
) {
  const [existing] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Rendez-vous');
  }

  if (!isAdmin(user) && existing.organizerId !== user.userId) {
    throw new ForbiddenError('Seul l\'organisateur peut modifier ce rendez-vous');
  }

  // Detach from recurrence (set recurrenceRuleId to null, keep recurrenceParentId for reference)
  const updateData: Record<string, any> = {
    recurrenceRuleId: null,
    updatedAt: new Date(),
  };

  if (input.title !== undefined) updateData.title = input.title;
  if (input.type !== undefined) updateData.type = input.type;
  if (input.scheduledAt !== undefined) updateData.scheduledAt = input.scheduledAt;
  if (input.endAt !== undefined) updateData.endAt = input.endAt;
  if (input.duration !== undefined) updateData.duration = input.duration;
  if (input.location !== undefined) updateData.location = input.location || null;
  if (input.locationType !== undefined) updateData.locationType = input.locationType;
  if (input.leadId !== undefined) updateData.leadId = input.leadId || null;
  if (input.clientId !== undefined) updateData.clientId = input.clientId || null;
  if (input.projectId !== undefined) updateData.projectId = input.projectId || null;
  if (input.notes !== undefined) updateData.notes = input.notes || null;
  if (input.metadata !== undefined) updateData.metadata = input.metadata || null;

  const [updated] = await db
    .update(appointments)
    .set(updateData)
    .where(eq(appointments.id, id))
    .returning();

  return updated;
}

/**
 * Update this and all following occurrences in the series.
 */
export async function updateFollowingOccurrences(
  id: string,
  input: UpdateAppointmentInput,
  user: JWTPayload
) {
  const [existing] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Rendez-vous');
  }

  if (!isAdmin(user) && existing.organizerId !== user.userId) {
    throw new ForbiddenError('Seul l\'organisateur peut modifier ce rendez-vous');
  }

  // Find the parent ID (either this is the parent, or it has a recurrenceParentId)
  const parentId = existing.recurrenceParentId || existing.id;

  // Get all occurrences at or after this appointment's scheduledAt
  const followingOccurrences = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(
      and(
        or(
          eq(appointments.id, parentId),
          eq(appointments.recurrenceParentId, parentId)
        ),
        gte(appointments.scheduledAt, existing.scheduledAt)
      )
    );

  const followingIds = followingOccurrences.map((o) => o.id);

  if (followingIds.length === 0) {
    throw new NotFoundError('Aucune occurrence à modifier');
  }

  const updateData: Record<string, any> = {
    updatedAt: new Date(),
  };

  if (input.title !== undefined) updateData.title = input.title;
  if (input.type !== undefined) updateData.type = input.type;
  if (input.location !== undefined) updateData.location = input.location || null;
  if (input.locationType !== undefined) updateData.locationType = input.locationType;
  if (input.duration !== undefined) updateData.duration = input.duration;
  if (input.leadId !== undefined) updateData.leadId = input.leadId || null;
  if (input.clientId !== undefined) updateData.clientId = input.clientId || null;
  if (input.projectId !== undefined) updateData.projectId = input.projectId || null;
  if (input.notes !== undefined) updateData.notes = input.notes || null;
  if (input.metadata !== undefined) updateData.metadata = input.metadata || null;

  // Note: scheduledAt/endAt are NOT bulk-updated because each occurrence has its own time.
  // Only fields that make sense to propagate are updated.

  const updated = await db
    .update(appointments)
    .set(updateData)
    .where(inArray(appointments.id, followingIds))
    .returning();

  return {
    updatedCount: updated.length,
    appointments: updated,
  };
}

/**
 * Delete all occurrences in a recurrence series.
 */
export async function deleteRecurrenceSeries(parentId: string, user: JWTPayload) {
  const [parent] = await db
    .select({ id: appointments.id, organizerId: appointments.organizerId, recurrenceRuleId: appointments.recurrenceRuleId })
    .from(appointments)
    .where(eq(appointments.id, parentId))
    .limit(1);

  if (!parent) {
    throw new NotFoundError('Rendez-vous parent');
  }

  if (!isAdmin(user) && parent.organizerId !== user.userId) {
    throw new ForbiddenError('Seul l\'organisateur peut supprimer cette série');
  }

  // Delete all children
  await db
    .delete(appointments)
    .where(eq(appointments.recurrenceParentId, parentId));

  // Delete parent
  await db
    .delete(appointments)
    .where(eq(appointments.id, parentId));

  // Delete recurrence rule if exists
  if (parent.recurrenceRuleId) {
    await db
      .delete(recurrenceRules)
      .where(eq(recurrenceRules.id, parent.recurrenceRuleId));
  }
}

// ─── KPIs ───────────────────────────────────────────────────────────────────

interface KPIFilter {
  fromDate?: Date;
  toDate?: Date;
}

/**
 * Get appointment KPIs / dashboard stats.
 */
export async function getAppointmentKPIs(user: JWTPayload, filters: KPIFilter) {
  const conditions: any[] = [];

  if (!isAdmin(user)) {
    // Get appointments where user is organizer or participant
    const participatingIds = await db
      .select({ appointmentId: appointmentParticipants.appointmentId })
      .from(appointmentParticipants)
      .where(eq(appointmentParticipants.userId, user.userId));

    const participatingAppointmentIds = participatingIds.map((p) => p.appointmentId);

    if (participatingAppointmentIds.length > 0) {
      conditions.push(
        or(
          eq(appointments.organizerId, user.userId),
          inArray(appointments.id, participatingAppointmentIds)
        )
      );
    } else {
      conditions.push(eq(appointments.organizerId, user.userId));
    }
  }

  if (filters.fromDate) {
    conditions.push(gte(appointments.scheduledAt, filters.fromDate));
  }
  if (filters.toDate) {
    conditions.push(lte(appointments.scheduledAt, filters.toDate));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Count by status
  const byStatus = await db
    .select({
      status: appointments.status,
      count: count(),
    })
    .from(appointments)
    .where(where)
    .groupBy(appointments.status);

  // Count by type
  const byType = await db
    .select({
      type: appointments.type,
      count: count(),
    })
    .from(appointments)
    .where(where)
    .groupBy(appointments.type);

  // Total and completion rate
  const totalResult = await db
    .select({ total: count() })
    .from(appointments)
    .where(where);

  const completedConditions = [...(conditions || []), eq(appointments.status, 'termine')];
  const completedResult = await db
    .select({ total: count() })
    .from(appointments)
    .where(and(...completedConditions));

  const noShowConditions = [...(conditions || []), eq(appointments.status, 'no_show')];
  const noShowResult = await db
    .select({ total: count() })
    .from(appointments)
    .where(and(...noShowConditions));

  const cancelledConditions = [...(conditions || []), eq(appointments.status, 'annule')];
  const cancelledResult = await db
    .select({ total: count() })
    .from(appointments)
    .where(and(...cancelledConditions));

  // Average duration for completed appointments
  const avgDurationConditions = [...(conditions || []), eq(appointments.status, 'termine')];
  const avgDurationResult = await db
    .select({
      avgDuration: sql<string>`COALESCE(AVG(${appointments.duration}), 0)`,
    })
    .from(appointments)
    .where(and(...avgDurationConditions));

  // Upcoming appointments count
  const now = new Date();
  const upcomingConditions = [
    ...(conditions || []),
    gte(appointments.scheduledAt, now),
    ne(appointments.status, 'annule'),
    ne(appointments.status, 'no_show'),
    ne(appointments.status, 'termine'),
  ];
  const upcomingResult = await db
    .select({ total: count() })
    .from(appointments)
    .where(and(...upcomingConditions));

  const total = totalResult[0]?.total ?? 0;
  const completed = completedResult[0]?.total ?? 0;
  const noShow = noShowResult[0]?.total ?? 0;
  const cancelled = cancelledResult[0]?.total ?? 0;
  const upcoming = upcomingResult[0]?.total ?? 0;
  const avgDuration = parseFloat(avgDurationResult[0]?.avgDuration || '0');
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const noShowRate = total > 0 ? Math.round((noShow / total) * 100) : 0;
  const cancellationRate = total > 0 ? Math.round((cancelled / total) * 100) : 0;

  return {
    total,
    completed,
    noShow,
    cancelled,
    upcoming,
    completionRate,
    noShowRate,
    cancellationRate,
    avgDuration: Math.round(avgDuration),
    byStatus,
    byType,
  };
}

// ─── Utility ────────────────────────────────────────────────────────────────

function parseTime(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours! * 60 + minutes!;
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

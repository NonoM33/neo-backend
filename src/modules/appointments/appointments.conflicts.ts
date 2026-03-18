import { and, eq, ne, notInArray, sql, lt, gt } from 'drizzle-orm';
import { db } from '../../config/database';
import { appointments, appointmentParticipants } from '../../db/schema';
import type { Appointment } from '../../db/schema/appointments';

export interface ConflictResult {
  userId: string;
  appointment: Pick<
    Appointment,
    'id' | 'title' | 'type' | 'status' | 'scheduledAt' | 'endAt' | 'organizerId'
  >;
}

/**
 * Check scheduling conflicts for a set of users in a given time range.
 *
 * Overlap condition: existing.scheduledAt < proposed.endAt AND existing.endAt > proposed.scheduledAt
 * Excludes appointments with status annule or no_show.
 */
export async function checkConflicts(
  scheduledAt: Date,
  endAt: Date,
  userIds: string[],
  excludeAppointmentId?: string
): Promise<ConflictResult[]> {
  if (userIds.length === 0) return [];

  const conflicts: ConflictResult[] = [];

  // Find all non-cancelled appointments that overlap the proposed time window
  // for any of the given users (as organizer or participant)
  const excludedStatuses = ['annule', 'no_show'] as const;

  // Build base conditions for overlap
  const overlapConditions = [
    lt(appointments.scheduledAt, endAt),
    gt(appointments.endAt, scheduledAt),
    notInArray(appointments.status, [...excludedStatuses]),
  ];

  if (excludeAppointmentId) {
    overlapConditions.push(ne(appointments.id, excludeAppointmentId));
  }

  // Check conflicts as organizer
  for (const userId of userIds) {
    const organizerConflicts = await db
      .select({
        id: appointments.id,
        title: appointments.title,
        type: appointments.type,
        status: appointments.status,
        scheduledAt: appointments.scheduledAt,
        endAt: appointments.endAt,
        organizerId: appointments.organizerId,
      })
      .from(appointments)
      .where(and(...overlapConditions, eq(appointments.organizerId, userId)));

    for (const appt of organizerConflicts) {
      conflicts.push({ userId, appointment: appt });
    }
  }

  // Check conflicts as participant
  for (const userId of userIds) {
    const participantConflicts = await db
      .select({
        id: appointments.id,
        title: appointments.title,
        type: appointments.type,
        status: appointments.status,
        scheduledAt: appointments.scheduledAt,
        endAt: appointments.endAt,
        organizerId: appointments.organizerId,
      })
      .from(appointments)
      .innerJoin(
        appointmentParticipants,
        eq(appointments.id, appointmentParticipants.appointmentId)
      )
      .where(
        and(
          ...overlapConditions,
          eq(appointmentParticipants.userId, userId),
          ne(appointments.organizerId, userId) // avoid duplicates with organizer check
        )
      );

    for (const appt of participantConflicts) {
      // Check this conflict is not already recorded (same appointment for same user)
      const alreadyRecorded = conflicts.some(
        (c) => c.userId === userId && c.appointment.id === appt.id
      );
      if (!alreadyRecorded) {
        conflicts.push({ userId, appointment: appt });
      }
    }
  }

  return conflicts;
}

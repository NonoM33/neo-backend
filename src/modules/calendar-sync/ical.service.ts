import { eq, and, gte, lte } from 'drizzle-orm';
import { db } from '../../config/database';
import { appointments, appointmentParticipants } from '../../db/schema';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Format a JS Date into an iCalendar DATETIME string (UTC).
 * Example: 20260317T143000Z
 */
function formatICalDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/**
 * Escape special characters per RFC 5545.
 */
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Map internal appointment statuses to iCalendar STATUS values.
 */
const STATUS_MAP: Record<string, string> = {
  propose: 'TENTATIVE',
  confirme: 'CONFIRMED',
  en_cours: 'CONFIRMED',
  termine: 'CONFIRMED',
  annule: 'CANCELLED',
  no_show: 'CANCELLED',
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate an iCalendar (RFC 5545) feed for a given user.
 *
 * Includes appointments from the past 30 days through the next 90 days where
 * the user is either the organizer or a participant.
 */
export async function generateICalFeed(userId: string): Promise<string> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const ninetyDaysAhead = new Date();
  ninetyDaysAhead.setDate(ninetyDaysAhead.getDate() + 90);

  // ── Appointments where user is organizer ──────────────────────────────────
  const ownAppointments = await db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.organizerId, userId),
        gte(appointments.scheduledAt, thirtyDaysAgo),
        lte(appointments.scheduledAt, ninetyDaysAhead)
      )
    );

  const ownIds = new Set(ownAppointments.map((a) => a.id));

  // ── Appointments where user is participant (but not organizer) ────────────
  const participantRecords = await db
    .select({ appointmentId: appointmentParticipants.appointmentId })
    .from(appointmentParticipants)
    .where(eq(appointmentParticipants.userId, userId));

  const participantAppointments: typeof ownAppointments = [];

  for (const record of participantRecords) {
    if (ownIds.has(record.appointmentId)) continue;

    const [appt] = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.id, record.appointmentId),
          gte(appointments.scheduledAt, thirtyDaysAgo),
          lte(appointments.scheduledAt, ninetyDaysAhead)
        )
      )
      .limit(1);

    if (appt) participantAppointments.push(appt);
  }

  const allAppointments = [...ownAppointments, ...participantAppointments];

  // ── Build VCALENDAR ───────────────────────────────────────────────────────
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Neo Domotique//CRM v1.0//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Neo Domotique - Agenda',
    'X-WR-TIMEZONE:Europe/Paris',
  ];

  for (const appt of allAppointments) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${appt.id}@neo-domotique.fr`);
    lines.push(`DTSTART:${formatICalDate(appt.scheduledAt)}`);
    lines.push(`DTEND:${formatICalDate(appt.endAt)}`);
    lines.push(
      `SUMMARY:${escapeICalText(appt.title || 'Rendez-vous Neo')}`
    );

    if (appt.notes) {
      lines.push(`DESCRIPTION:${escapeICalText(appt.notes)}`);
    }
    if (appt.location) {
      lines.push(`LOCATION:${escapeICalText(appt.location)}`);
    }

    lines.push(`STATUS:${STATUS_MAP[appt.status] || 'TENTATIVE'}`);
    lines.push(`CREATED:${formatICalDate(appt.createdAt)}`);
    lines.push(`LAST-MODIFIED:${formatICalDate(appt.updatedAt)}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
}

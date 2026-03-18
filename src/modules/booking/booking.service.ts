import { eq } from 'drizzle-orm';
import { db } from '../../config/database';
import { appointments, appointmentTypeConfigs } from '../../db/schema';
import { leads } from '../../db/schema/crm';
import { users, roles, userRoles } from '../../db/schema/users';
import { ValidationError, ConflictError } from '../../lib/errors';
import { getAvailableSlots } from '../appointments/appointments.service';
import { checkConflicts } from '../appointments/appointments.conflicts';
import { dispatchAppointment } from './booking.dispatch';
import type { PublicBookingInput } from './booking.schema';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Appointment types available for public online booking. */
const PUBLIC_TYPES = ['visite_technique', 'audit', 'rdv_commercial'];

/** Default duration (minutes) per public appointment type. */
const TYPE_DURATIONS: Record<string, number> = {
  visite_technique: 90,
  audit: 120,
  rdv_commercial: 60,
};

/** Human-readable labels for public types. */
const TYPE_LABELS: Record<string, string> = {
  visite_technique: 'Visite technique',
  audit: 'Audit',
  rdv_commercial: 'RDV Commercial',
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Return the appointment types available for public online booking.
 */
export async function getPublicAppointmentTypes() {
  const configs = await db
    .select()
    .from(appointmentTypeConfigs)
    .where(eq(appointmentTypeConfigs.isActive, true));

  return configs
    .filter((c) => PUBLIC_TYPES.includes(c.type))
    .map((c) => ({
      type: c.type,
      label: c.label,
      defaultDuration: c.defaultDuration,
      color: c.color,
      icon: c.icon,
    }));
}

/**
 * Return aggregated available slots across **all** eligible users for a given
 * public appointment type.
 *
 * The caller only needs to know *which* time slots exist; the specific user
 * assignment happens later during booking via the dispatch algorithm.
 *
 * The date range is capped at 14 days to keep response sizes reasonable.
 */
export async function getAggregatedSlots(
  type: string,
  fromDate: Date,
  toDate: Date
) {
  if (!PUBLIC_TYPES.includes(type)) {
    throw new ValidationError(
      'Type de rendez-vous non disponible en ligne'
    );
  }

  // Cap the range at 14 days
  const maxDate = new Date(fromDate.getTime() + 14 * 24 * 60 * 60 * 1000);
  const effectiveToDate = toDate > maxDate ? maxDate : toDate;

  const duration = TYPE_DURATIONS[type] || 60;

  // Determine which roles may handle this type
  const [typeConfig] = await db
    .select({ allowedRoles: appointmentTypeConfigs.allowedRoles })
    .from(appointmentTypeConfigs)
    .where(eq(appointmentTypeConfigs.type, type as any))
    .limit(1);

  const configRoles = typeConfig?.allowedRoles as string[] | null | undefined;
  const allowedRoles =
    configRoles && configRoles.length > 0 ? configRoles : ['commercial'];

  // Fetch all active users
  const allUsers = await db
    .select({
      id: users.id,
      role: users.role,
    })
    .from(users)
    .where(eq(users.isActive, true));

  // Resolve junction-table roles for users who might be 'commercial'
  const eligibleUserIds: string[] = [];

  for (const user of allUsers) {
    // Legacy role check
    if (allowedRoles.includes(user.role)) {
      eligibleUserIds.push(user.id);
      continue;
    }
    // Junction table check (covers 'commercial' and future roles)
    const junctionRoles = await db
      .select({ roleName: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, user.id));

    if (junctionRoles.some((r) => allowedRoles.includes(r.roleName))) {
      eligibleUserIds.push(user.id);
    }
  }

  if (eligibleUserIds.length === 0) return [];

  // Collect all unique slots across eligible users
  const slotMap = new Map<
    string,
    { date: string; startTime: string; endTime: string }
  >();

  for (const userId of eligibleUserIds) {
    try {
      const userSlots = await getAvailableSlots(
        userId,
        fromDate,
        effectiveToDate,
        duration
      );

      for (const slot of userSlots) {
        const key = `${slot.date}_${slot.startTime}`;
        if (!slotMap.has(key)) {
          slotMap.set(key, {
            date: slot.date,
            startTime: slot.startTime,
            endTime: slot.endTime,
          });
        }
      }
    } catch {
      // Skip users whose availability can't be computed
      continue;
    }
  }

  // Sort by date, then start time
  const result = Array.from(slotMap.values());
  result.sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    return d !== 0 ? d : a.startTime.localeCompare(b.startTime);
  });

  return result;
}

/**
 * Create a public booking from the site vitrine.
 *
 * Flow:
 * 1. Honeypot check (silent rejection of bots)
 * 2. Build & validate the requested time slot
 * 3. Auto-dispatch to the best available user (least-busy algorithm)
 * 4. Final conflict check (race-condition guard)
 * 5. Create a lead (source: site_web)
 * 6. Create the appointment (status: propose)
 */
export async function createPublicBooking(input: PublicBookingInput) {
  // ── Honeypot ──────────────────────────────────────────────────────────────
  if (input.website && input.website.length > 0) {
    // Silently "accept" so bots think they succeeded
    return {
      success: true,
      message: 'Votre rendez-vous a bien \u00e9t\u00e9 enregistr\u00e9.',
    };
  }

  const duration = TYPE_DURATIONS[input.type] || 60;

  // ── Build scheduled dates ─────────────────────────────────────────────────
  const scheduledAt = new Date(`${input.date}T${input.startTime}:00`);
  const endAt = new Date(scheduledAt.getTime() + duration * 60_000);

  if (scheduledAt <= new Date()) {
    throw new ValidationError(
      'Le cr\u00e9neau s\u00e9lectionn\u00e9 est dans le pass\u00e9'
    );
  }

  // ── Dispatch ──────────────────────────────────────────────────────────────
  const assigned = await dispatchAppointment(input.type, scheduledAt, endAt);

  if (!assigned) {
    throw new ConflictError(
      'Aucun cr\u00e9neau disponible pour ce type de rendez-vous. Veuillez choisir un autre horaire.'
    );
  }

  // ── Final conflict check (race condition guard) ───────────────────────────
  const conflicts = await checkConflicts(scheduledAt, endAt, [
    assigned.userId,
  ]);
  if (conflicts.length > 0) {
    throw new ConflictError(
      "Ce cr\u00e9neau vient d'\u00eatre pris. Veuillez en choisir un autre."
    );
  }

  // ── Create lead ───────────────────────────────────────────────────────────
  const leadTitle = `Demande de ${TYPE_LABELS[input.type] || input.type}`;

  const [lead] = await db
    .insert(leads)
    .values({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      title: leadTitle,
      description: input.message || null,
      status: 'prospect',
      source: 'site_web',
      ownerId: assigned.userId,
      postalCode: input.postalCode,
      address: null,
      city: null,
    })
    .returning();

  if (!lead) {
    throw new Error("Erreur lors de la cr\u00e9ation du lead");
  }

  // ── Create appointment ────────────────────────────────────────────────────
  const title = `${TYPE_LABELS[input.type] || input.type} - ${input.firstName} ${input.lastName}`;

  const notes = [
    input.housingType ? `Type de logement: ${input.housingType}` : '',
    input.needs?.length ? `Besoins: ${input.needs.join(', ')}` : '',
    input.message ? `Message: ${input.message}` : '',
    `Code postal: ${input.postalCode}`,
  ]
    .filter(Boolean)
    .join('\n');

  const [appointment] = await db
    .insert(appointments)
    .values({
      title,
      type: input.type as any,
      status: 'propose',
      scheduledAt,
      endAt,
      duration,
      location: null,
      locationType: 'sur_site',
      organizerId: assigned.userId,
      leadId: lead.id,
      notes,
      location: `${input.address}, ${input.postalCode} ${input.city}`,
      metadata: {
        source: 'public_booking',
        housingType: input.housingType,
        needs: input.needs,
        address: input.address,
        postalCode: input.postalCode,
        city: input.city,
        phone: input.phone,
        email: input.email,
        clientName: `${input.firstName} ${input.lastName}`,
      },
    })
    .returning();

  // ── Generate public token for manage link ──────────────────────────────
  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  await db
    .update(appointments)
    .set({ publicToken: token })
    .where(eq(appointments.id, appointment!.id));

  // ── Send confirmation SMS ──────────────────────────────────────────────
  if (input.phone) {
    const { sendSms } = await import('../../lib/sms');
    const typeLabels: Record<string, string> = {
      visite_technique: 'Visite technique',
      audit: 'Audit complet',
      rdv_commercial: 'RDV Commercial',
    };
    const dateObj = new Date(`${input.date}T00:00:00`);
    const dateStr = dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    const manageUrl = `https://neo-domotique.fr/rdv?t=${token}`;

    const smsMessage = [
      `Bonjour ${input.firstName} ! 🏠`,
      ``,
      `Votre ${typeLabels[input.type] || 'rendez-vous'} Neo Domotique est confirme :`,
      `📅 ${dateStr} a ${input.startTime}`,
      `📍 ${input.address}, ${input.postalCode} ${input.city}`,
      `👤 ${assigned.firstName} se deplacera chez vous`,
      ``,
      `Modifier ou annuler : ${manageUrl}`,
      ``,
      `A tres bientot !`,
      `L'equipe Neo Domotique`,
    ].join('\n');

    sendSms({
      phoneNumber: input.phone,
      message: smsMessage,
      clientId: lead?.clientId || undefined,
      context: 'booking_confirmation',
      contextId: appointment?.id,
    }).catch((err: any) => console.error('[SMS] Booking confirmation failed:', err.message));
  }

  return {
    success: true,
    appointmentId: appointment?.id,
    publicToken: token,
    message:
      'Votre rendez-vous a bien \u00e9t\u00e9 enregistr\u00e9. Vous serez recontact\u00e9 sous 24h pour confirmation.',
    date: input.date,
    startTime: input.startTime,
    type: input.type,
    assignedTo: `${assigned.firstName} ${assigned.lastName}`,
  };
}

// ─── Public appointment management (via token) ────────────────────────────

export async function getAppointmentByToken(token: string) {
  const [appt] = await db
    .select({
      id: appointments.id,
      type: appointments.type,
      status: appointments.status,
      scheduledAt: appointments.scheduledAt,
      endAt: appointments.endAt,
      duration: appointments.duration,
      location: appointments.location,
      organizerFirstName: users.firstName,
      organizerLastName: users.lastName,
      organizerPhone: users.phone,
      notes: appointments.notes,
      metadata: appointments.metadata,
    })
    .from(appointments)
    .innerJoin(users, eq(appointments.organizerId, users.id))
    .where(eq(appointments.publicToken, token))
    .limit(1);

  if (!appt) return null;

  const meta = appt.metadata as any;
  return {
    id: appt.id,
    type: appt.type,
    status: appt.status,
    scheduledAt: appt.scheduledAt,
    endAt: appt.endAt,
    duration: appt.duration,
    location: appt.location,
    organizer: {
      firstName: appt.organizerFirstName,
      lastName: appt.organizerLastName,
      phone: appt.organizerPhone,
    },
    client: {
      name: meta?.clientName || null,
      address: meta?.address || null,
      postalCode: meta?.postalCode || null,
      city: meta?.city || null,
    },
  };
}

export async function cancelAppointmentByToken(token: string, reason?: string) {
  const [appt] = await db
    .select({ id: appointments.id, status: appointments.status })
    .from(appointments)
    .where(eq(appointments.publicToken, token))
    .limit(1);

  if (!appt) throw new ValidationError('Rendez-vous introuvable');
  if (appt.status === 'annule') throw new ValidationError('Ce rendez-vous est deja annule');
  if (appt.status === 'termine') throw new ValidationError('Ce rendez-vous est deja termine');

  await db.update(appointments).set({
    status: 'annule',
    cancellationReason: reason || 'Annule par le client via lien SMS',
    updatedAt: new Date(),
  }).where(eq(appointments.id, appt.id));

  return { success: true };
}

export async function rescheduleAppointmentByToken(
  token: string,
  newDate: string,
  newStartTime: string
) {
  const [appt] = await db
    .select({
      id: appointments.id,
      status: appointments.status,
      type: appointments.type,
      duration: appointments.duration,
      organizerId: appointments.organizerId,
      metadata: appointments.metadata,
    })
    .from(appointments)
    .where(eq(appointments.publicToken, token))
    .limit(1);

  if (!appt) throw new ValidationError('Rendez-vous introuvable');
  if (appt.status === 'annule') throw new ValidationError('Ce rendez-vous est annule');
  if (appt.status === 'termine') throw new ValidationError('Ce rendez-vous est termine');

  const newScheduledAt = new Date(`${newDate}T${newStartTime}:00`);
  const newEndAt = new Date(newScheduledAt.getTime() + appt.duration * 60_000);

  if (newScheduledAt <= new Date(Date.now() + 24 * 60 * 60 * 1000)) {
    throw new ValidationError('Le nouveau creneau doit etre dans plus de 24h');
  }

  // Check conflicts for the organizer
  const conflicts = await checkConflicts(newScheduledAt, newEndAt, [appt.organizerId], appt.id);
  if (conflicts.length > 0) {
    throw new ConflictError('Ce creneau est deja pris. Veuillez en choisir un autre.');
  }

  await db.update(appointments).set({
    scheduledAt: newScheduledAt,
    endAt: newEndAt,
    reminder2hSent: false,
    reminder30mSent: false,
    updatedAt: new Date(),
  }).where(eq(appointments.id, appt.id));

  // Send SMS confirmation of reschedule
  const meta = appt.metadata as any;
  if (meta?.phone) {
    const { sendSms } = await import('../../lib/sms');
    const typeLabels: Record<string, string> = {
      visite_technique: 'Visite technique',
      audit: 'Audit complet',
      rdv_commercial: 'RDV Commercial',
    };
    const dateObj = new Date(`${newDate}T00:00:00`);
    const dateStr = dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

    sendSms({
      phoneNumber: meta.phone,
      message: [
        `✅ Neo Domotique - RDV modifie`,
        ``,
        `Votre ${typeLabels[appt.type] || 'rendez-vous'} est deplace au :`,
        `📅 ${dateStr} a ${newStartTime}`,
        ``,
        `A bientot !`,
      ].join('\n'),
      context: 'booking_reschedule',
      contextId: appt.id,
    }).catch(() => {});
  }

  return { success: true, scheduledAt: newScheduledAt, endAt: newEndAt };
}

// ─── SMS Reminders (called by cron) ────────────────────────────────────────

export async function sendReminders() {
  const { sendSms } = await import('../../lib/sms');
  const { and, gte, lte, not } = await import('drizzle-orm');

  const now = new Date();
  const typeLabels: Record<string, string> = {
    visite_technique: 'Visite technique',
    audit: 'Audit complet',
    rdv_commercial: 'RDV Commercial',
  };

  // 2h reminder: appointments between 1h50 and 2h10 from now
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const twoHMin = new Date(twoHoursFromNow.getTime() - 10 * 60 * 1000);
  const twoHMax = new Date(twoHoursFromNow.getTime() + 10 * 60 * 1000);

  const upcoming2h = await db
    .select({
      id: appointments.id,
      type: appointments.type,
      scheduledAt: appointments.scheduledAt,
      publicToken: appointments.publicToken,
      metadata: appointments.metadata,
      organizerFirstName: users.firstName,
    })
    .from(appointments)
    .innerJoin(users, eq(appointments.organizerId, users.id))
    .where(and(
      gte(appointments.scheduledAt, twoHMin),
      lte(appointments.scheduledAt, twoHMax),
      eq(appointments.status, 'propose'),
      eq(appointments.reminder2hSent, false),
    ));

  for (const appt of upcoming2h) {
    const meta = appt.metadata as any;
    const phone = meta?.phone || meta?.clientPhone;
    if (!phone) continue;

    const dateStr = appt.scheduledAt.toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const msg = [
      `⏰ Rappel Neo Domotique`,
      ``,
      `Votre ${typeLabels[appt.type] || 'rendez-vous'} est dans 2h (${dateStr}).`,
      `${appt.organizerFirstName} sera chez vous.`,
      ``,
      appt.publicToken ? `Gerer : https://neo-domotique.fr/rdv?t=${appt.publicToken}` : '',
    ].filter(Boolean).join('\n');

    await sendSms({ phoneNumber: phone, message: msg, context: 'reminder_2h', contextId: appt.id });
    await db.update(appointments).set({ reminder2hSent: true }).where(eq(appointments.id, appt.id));
  }

  // 30min reminder: appointments between 20 and 40 min from now
  const thirtyMin = new Date(now.getTime() + 30 * 60 * 1000);
  const thirtyMin_min = new Date(thirtyMin.getTime() - 10 * 60 * 1000);
  const thirtyMin_max = new Date(thirtyMin.getTime() + 10 * 60 * 1000);

  const upcoming30m = await db
    .select({
      id: appointments.id,
      type: appointments.type,
      scheduledAt: appointments.scheduledAt,
      publicToken: appointments.publicToken,
      metadata: appointments.metadata,
      organizerFirstName: users.firstName,
    })
    .from(appointments)
    .innerJoin(users, eq(appointments.organizerId, users.id))
    .where(and(
      gte(appointments.scheduledAt, thirtyMin_min),
      lte(appointments.scheduledAt, thirtyMin_max),
      eq(appointments.status, 'propose'),
      eq(appointments.reminder30mSent, false),
    ));

  for (const appt of upcoming30m) {
    const meta = appt.metadata as any;
    const phone = meta?.phone || meta?.clientPhone;
    if (!phone) continue;

    const msg = [
      `🏠 Neo Domotique - On arrive !`,
      ``,
      `${appt.organizerFirstName} sera chez vous dans environ 30 minutes.`,
      ``,
      appt.publicToken ? `Suivre : https://neo-domotique.fr/rdv?t=${appt.publicToken}` : '',
    ].filter(Boolean).join('\n');

    await sendSms({ phoneNumber: phone, message: msg, context: 'reminder_30m', contextId: appt.id });
    await db.update(appointments).set({ reminder30mSent: true }).where(eq(appointments.id, appt.id));
  }

  return { sent2h: upcoming2h.length, sent30m: upcoming30m.length };
}

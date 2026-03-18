import { eq, and, desc, inArray } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { db } from '../../config/database';
import { env } from '../../config/env';
import {
  trackingSessions,
  trackingLocationHistory,
  appointments,
  clients,
  users,
  type TrackingSession,
} from '../../db/schema';
import { NotFoundError, BadRequestError } from '../../lib/errors';
import { geocodeAddress } from './tracking.geocode';
import { calculateETA } from './tracking.eta';
import { sendTrackingSms } from './tracking.sms';
import type { StartTrackingInput, UpdateLocationInput } from './tracking.schema';

/**
 * Generate a secure random token (96 chars)
 */
function generateToken(): string {
  return randomBytes(48).toString('hex');
}

/**
 * Start a new tracking session for an appointment
 */
export async function startTracking(
  input: StartTrackingInput,
  auditorId: string
): Promise<{ session: TrackingSession; trackingUrl: string; smsSent: boolean }> {
  // Fetch appointment with client and organizer
  const [appointment] = await db
    .select({
      id: appointments.id,
      scheduledAt: appointments.scheduledAt,
      location: appointments.location,
      clientId: appointments.clientId,
      organizerId: appointments.organizerId,
      status: appointments.status,
    })
    .from(appointments)
    .where(eq(appointments.id, input.appointmentId))
    .limit(1);

  if (!appointment) {
    throw new NotFoundError('Rendez-vous introuvable');
  }

  if (appointment.status === 'annule' || appointment.status === 'termine') {
    throw new BadRequestError('Ce rendez-vous est terminé ou annulé');
  }

  // Check if there's already an active session for this appointment
  const [existingSession] = await db
    .select()
    .from(trackingSessions)
    .where(
      and(
        eq(trackingSessions.appointmentId, input.appointmentId),
        inArray(trackingSessions.status, ['pending', 'active'])
      )
    )
    .limit(1);

  if (existingSession) {
    throw new BadRequestError('Une session de tracking est déjà active pour ce rendez-vous');
  }

  // Get client info if available
  let client = null;
  if (appointment.clientId) {
    [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, appointment.clientId))
      .limit(1);
  }

  // Get auditor info
  const [auditor] = await db
    .select({ firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.id, auditorId))
    .limit(1);

  // Geocode destination address
  let destLat: number | null = null;
  let destLng: number | null = null;

  if (appointment.location) {
    const geocoded = await geocodeAddress(appointment.location);
    if (geocoded) {
      destLat = geocoded.lat;
      destLng = geocoded.lng;
    }
  }

  // Calculate initial ETA if we have both positions
  let etaMinutes: number | null = null;
  if (destLat !== null && destLng !== null) {
    const eta = await calculateETA(input.currentLat, input.currentLng, destLat, destLng);
    if (eta) {
      etaMinutes = eta.durationMinutes;
    }
  }

  // Generate token and create session
  const token = generateToken();
  const expiresAt = new Date(Date.now() + env.TRACKING_EXPIRY_HOURS * 60 * 60 * 1000);

  const [session] = await db
    .insert(trackingSessions)
    .values({
      token,
      appointmentId: input.appointmentId,
      auditorId,
      clientId: appointment.clientId,
      status: 'active',
      destinationAddress: appointment.location,
      destinationLat: destLat?.toString(),
      destinationLng: destLng?.toString(),
      currentLat: input.currentLat.toString(),
      currentLng: input.currentLng.toString(),
      currentLocationUpdatedAt: new Date(),
      etaMinutes,
      etaUpdatedAt: etaMinutes ? new Date() : null,
      startedAt: new Date(),
      expiresAt,
      smsPhoneNumber: client?.phone || null,
    })
    .returning();

  // Record initial location in history
  await db.insert(trackingLocationHistory).values({
    sessionId: session!.id,
    lat: input.currentLat.toString(),
    lng: input.currentLng.toString(),
  });

  const trackingUrl = `${env.PUBLIC_URL}/tracking/${token}`;
  let smsSent = false;

  // Send SMS to client if phone available
  if (client?.phone && auditor) {
    const appointmentTime = new Date(appointment.scheduledAt).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const smsResult = await sendTrackingSms({
      phoneNumber: client.phone,
      clientFirstName: client.firstName,
      auditorName: `${auditor.firstName} ${auditor.lastName}`,
      appointmentTime,
      trackingUrl,
      clientId: client.id,
      appointmentId: input.appointmentId,
    });

    if (smsResult.success) {
      smsSent = true;
      await db
        .update(trackingSessions)
        .set({ smsSentAt: new Date() })
        .where(eq(trackingSessions.id, session!.id));
    }
  }

  return { session: session!, trackingUrl, smsSent };
}

/**
 * Update auditor location
 */
export async function updateLocation(
  sessionId: string,
  input: UpdateLocationInput,
  auditorId: string
): Promise<{ session: TrackingSession; etaMinutes: number | null }> {
  // Verify session ownership and status
  const [session] = await db
    .select()
    .from(trackingSessions)
    .where(eq(trackingSessions.id, sessionId))
    .limit(1);

  if (!session) {
    throw new NotFoundError('Session de tracking introuvable');
  }

  if (session.auditorId !== auditorId) {
    throw new BadRequestError('Vous n\'êtes pas autorisé à modifier cette session');
  }

  if (session.status !== 'active') {
    throw new BadRequestError('Cette session de tracking n\'est plus active');
  }

  // Check expiry
  if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
    await db
      .update(trackingSessions)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(eq(trackingSessions.id, sessionId));
    throw new BadRequestError('Cette session de tracking a expiré');
  }

  // Record location in history
  await db.insert(trackingLocationHistory).values({
    sessionId,
    lat: input.lat.toString(),
    lng: input.lng.toString(),
    accuracy: input.accuracy?.toString(),
    heading: input.heading?.toString(),
    speed: input.speed?.toString(),
  });

  // Calculate new ETA if destination coordinates exist
  let etaMinutes: number | null = null;
  const shouldUpdateEta =
    session.destinationLat &&
    session.destinationLng &&
    (!session.etaUpdatedAt || new Date().getTime() - new Date(session.etaUpdatedAt).getTime() > 30000);

  if (shouldUpdateEta) {
    const eta = await calculateETA(
      input.lat,
      input.lng,
      parseFloat(session.destinationLat!),
      parseFloat(session.destinationLng!)
    );
    if (eta) {
      etaMinutes = eta.durationMinutes;
    }
  } else {
    etaMinutes = session.etaMinutes;
  }

  // Update session
  const [updatedSession] = await db
    .update(trackingSessions)
    .set({
      currentLat: input.lat.toString(),
      currentLng: input.lng.toString(),
      currentLocationUpdatedAt: new Date(),
      ...(shouldUpdateEta && etaMinutes !== null
        ? { etaMinutes, etaUpdatedAt: new Date() }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(trackingSessions.id, sessionId))
    .returning();

  return { session: updatedSession!, etaMinutes };
}

/**
 * Mark auditor as arrived
 */
export async function markArrived(sessionId: string, auditorId: string): Promise<TrackingSession> {
  const [session] = await db
    .select()
    .from(trackingSessions)
    .where(eq(trackingSessions.id, sessionId))
    .limit(1);

  if (!session) {
    throw new NotFoundError('Session de tracking introuvable');
  }

  if (session.auditorId !== auditorId) {
    throw new BadRequestError('Vous n\'êtes pas autorisé à modifier cette session');
  }

  if (session.status !== 'active') {
    throw new BadRequestError('Cette session de tracking n\'est plus active');
  }

  const [updated] = await db
    .update(trackingSessions)
    .set({
      status: 'arrived',
      arrivedAt: new Date(),
      etaMinutes: 0,
      updatedAt: new Date(),
    })
    .where(eq(trackingSessions.id, sessionId))
    .returning();

  return updated!;
}

/**
 * Cancel tracking session
 */
export async function cancelTracking(sessionId: string, auditorId: string): Promise<TrackingSession> {
  const [session] = await db
    .select()
    .from(trackingSessions)
    .where(eq(trackingSessions.id, sessionId))
    .limit(1);

  if (!session) {
    throw new NotFoundError('Session de tracking introuvable');
  }

  if (session.auditorId !== auditorId) {
    throw new BadRequestError('Vous n\'êtes pas autorisé à modifier cette session');
  }

  if (session.status === 'arrived') {
    throw new BadRequestError('Impossible d\'annuler une session déjà terminée');
  }

  const [updated] = await db
    .update(trackingSessions)
    .set({
      status: 'cancelled',
      updatedAt: new Date(),
    })
    .where(eq(trackingSessions.id, sessionId))
    .returning();

  return updated!;
}

/**
 * Get active sessions for an auditor
 */
export async function getActiveSessions(auditorId: string): Promise<TrackingSession[]> {
  const sessions = await db
    .select()
    .from(trackingSessions)
    .where(
      and(
        eq(trackingSessions.auditorId, auditorId),
        inArray(trackingSessions.status, ['pending', 'active'])
      )
    )
    .orderBy(desc(trackingSessions.createdAt));

  return sessions;
}

/**
 * Get session by public token (for client view)
 */
export async function getSessionByToken(token: string): Promise<{
  session: TrackingSession;
  auditorName: string;
  appointmentTime: Date;
} | null> {
  const [result] = await db
    .select({
      session: trackingSessions,
      auditorFirstName: users.firstName,
      auditorLastName: users.lastName,
      appointmentTime: appointments.scheduledAt,
    })
    .from(trackingSessions)
    .innerJoin(users, eq(trackingSessions.auditorId, users.id))
    .innerJoin(appointments, eq(trackingSessions.appointmentId, appointments.id))
    .where(eq(trackingSessions.token, token))
    .limit(1);

  if (!result) {
    return null;
  }

  return {
    session: result.session,
    auditorName: `${result.auditorFirstName} ${result.auditorLastName}`,
    appointmentTime: result.appointmentTime,
  };
}

/**
 * Get location history for a session (for drawing the route)
 */
export async function getLocationHistory(
  sessionId: string
): Promise<Array<{ lat: number; lng: number; recordedAt: Date }>> {
  const history = await db
    .select({
      lat: trackingLocationHistory.lat,
      lng: trackingLocationHistory.lng,
      recordedAt: trackingLocationHistory.recordedAt,
    })
    .from(trackingLocationHistory)
    .where(eq(trackingLocationHistory.sessionId, sessionId))
    .orderBy(trackingLocationHistory.recordedAt);

  return history.map((h) => ({
    lat: parseFloat(h.lat),
    lng: parseFloat(h.lng),
    recordedAt: h.recordedAt,
  }));
}

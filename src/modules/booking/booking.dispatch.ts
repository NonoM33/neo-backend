import { eq, and, gte, lte, count, ne } from 'drizzle-orm';
import { db } from '../../config/database';
import { users, roles, userRoles } from '../../db/schema/users';
import { appointments, appointmentTypeConfigs } from '../../db/schema';
import { getAvailableSlots } from '../appointments/appointments.service';

/**
 * Map public appointment types to the roles allowed to handle them.
 * Ordered from most-specific to broadest: the dispatch prefers
 * the first matching role when multiple candidates have equal load.
 */
const TYPE_ROLE_MAP: Record<string, string[]> = {
  visite_technique: ['integrateur', 'auditeur', 'commercial'],
  audit: ['auditeur', 'commercial'],
  rdv_commercial: ['commercial'],
};

interface DispatchResult {
  userId: string;
  firstName: string;
  lastName: string;
}

/**
 * Resolve the effective roles for a user.
 *
 * The legacy `role` field only covers admin/integrateur/auditeur.
 * Commercials are tracked via the `user_roles` junction table.
 * We merge both sources to get the full picture.
 */
async function getUserEffectiveRoles(userId: string): Promise<string[]> {
  const roleRecords = await db
    .select({ roleName: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId));

  return roleRecords.map((r) => r.roleName);
}

/**
 * Find the best available user for a given appointment type and time slot.
 *
 * Strategy: **least-busy** (fewest upcoming appointments in the next 7 days)
 * among users who are both role-eligible and have the requested slot free.
 * Ties are broken randomly so the load spreads evenly.
 */
export async function dispatchAppointment(
  type: string,
  scheduledAt: Date,
  endAt: Date
): Promise<DispatchResult | null> {
  // Determine which roles can handle this type
  const fallbackRoles = TYPE_ROLE_MAP[type] || ['commercial'];

  // Check if there's a type config with explicit allowedRoles
  const [typeConfig] = await db
    .select({ allowedRoles: appointmentTypeConfigs.allowedRoles })
    .from(appointmentTypeConfigs)
    .where(eq(appointmentTypeConfigs.type, type as any))
    .limit(1);

  const configRoles = typeConfig?.allowedRoles as string[] | null | undefined;
  const allowedRoles =
    configRoles && configRoles.length > 0 ? configRoles : fallbackRoles;

  // Fetch all active users
  const allActiveUsers = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role, // legacy field (admin | integrateur | auditeur)
    })
    .from(users)
    .where(eq(users.isActive, true));

  if (allActiveUsers.length === 0) return null;

  // Resolve effective roles for each user (legacy + junction table)
  // and keep those who have at least one matching role.
  const eligibleUsers: typeof allActiveUsers = [];

  for (const user of allActiveUsers) {
    // Start with the legacy role
    const effectiveRoles = new Set<string>([user.role]);

    // Add roles from the junction table (includes 'commercial')
    const junctionRoles = await getUserEffectiveRoles(user.id);
    for (const r of junctionRoles) effectiveRoles.add(r);

    if (allowedRoles.some((r) => effectiveRoles.has(r))) {
      eligibleUsers.push(user);
    }
  }

  if (eligibleUsers.length === 0) return null;

  // Duration of the requested slot in minutes
  const duration = Math.round(
    (endAt.getTime() - scheduledAt.getTime()) / 60_000
  );

  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // For each eligible user: check slot availability, then count upcoming load
  const candidates: {
    userId: string;
    firstName: string;
    lastName: string;
    appointmentCount: number;
  }[] = [];

  for (const user of eligibleUsers) {
    try {
      const slots = await getAvailableSlots(
        user.id,
        scheduledAt,
        endAt,
        duration
      );

      // The requested time must appear in the user's free slots
      const requestedTime = scheduledAt.toTimeString().slice(0, 5); // HH:MM
      const requestedDate = scheduledAt.toISOString().split('T')[0];

      const hasSlot = slots.some(
        (s) => s.date === requestedDate && s.startTime === requestedTime
      );

      if (!hasSlot) continue;

      // Count their appointments in the next 7 days (to measure busyness)
      const [countResult] = await db
        .select({ value: count() })
        .from(appointments)
        .where(
          and(
            eq(appointments.organizerId, user.id),
            gte(appointments.scheduledAt, now),
            lte(appointments.scheduledAt, weekFromNow),
            ne(appointments.status, 'annule'),
            ne(appointments.status, 'no_show')
          )
        );

      candidates.push({
        userId: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        appointmentCount: Number(countResult?.value ?? 0),
      });
    } catch {
      // Skip users whose availability cannot be computed
      continue;
    }
  }

  if (candidates.length === 0) return null;

  // Sort by least busy
  candidates.sort((a, b) => a.appointmentCount - b.appointmentCount);

  // Among equally-busy candidates, pick randomly
  const minCount = candidates[0]!.appointmentCount;
  const leastBusy = candidates.filter(
    (u) => u.appointmentCount === minCount
  );
  const picked = leastBusy[Math.floor(Math.random() * leastBusy.length)]!;

  return {
    userId: picked.userId,
    firstName: picked.firstName,
    lastName: picked.lastName,
  };
}

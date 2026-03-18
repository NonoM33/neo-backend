import { eq, and, sql, count, gte, lte, SQL, ne } from 'drizzle-orm';
import { db } from '../../config/database';
import { leads, activities, salesObjectives, projects, quotes, appointments, appointmentParticipants } from '../../db/schema';
import { NotFoundError, ForbiddenError } from '../../lib/errors';
import { isAdmin } from '../../middleware/rbac.middleware';
import type { JWTPayload } from '../../middleware/auth.middleware';
import type { SalesObjectiveInput, KPIFilter } from './kpis.schema';

// Dashboard data - overview stats
export async function getDashboardData(user: JWTPayload, filters: KPIFilter) {
  const userCondition = !isAdmin(user) || filters.userId
    ? filters.userId || user.userId
    : null;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Build date conditions
  const fromDate = filters.fromDate || startOfMonth;
  const toDate = filters.toDate || endOfMonth;

  // Lead conditions
  const leadConditions: SQL[] = [
    gte(leads.createdAt, fromDate),
    lte(leads.createdAt, toDate),
  ];
  if (userCondition) {
    leadConditions.push(eq(leads.ownerId, userCondition));
  }

  // Activity conditions
  const activityConditions: SQL[] = [
    gte(activities.createdAt, fromDate),
    lte(activities.createdAt, toDate),
  ];
  if (userCondition) {
    activityConditions.push(eq(activities.ownerId, userCondition));
  }

  const [
    leadsCreated,
    leadsWon,
    leadsLost,
    activitiesCompleted,
    totalLeadValue,
    weightedValue,
  ] = await Promise.all([
    // Total leads created
    db
      .select({ count: count() })
      .from(leads)
      .where(and(...leadConditions)),

    // Leads won
    db
      .select({ count: count() })
      .from(leads)
      .where(and(...leadConditions, eq(leads.status, 'gagne'))),

    // Leads lost
    db
      .select({ count: count() })
      .from(leads)
      .where(and(...leadConditions, eq(leads.status, 'perdu'))),

    // Activities completed
    db
      .select({ count: count() })
      .from(activities)
      .where(and(...activityConditions, eq(activities.status, 'termine'))),

    // Total estimated value
    db
      .select({
        total: sql<string>`COALESCE(SUM(${leads.estimatedValue}), 0)`,
      })
      .from(leads)
      .where(and(...leadConditions)),

    // Weighted value (value * probability)
    db
      .select({
        total: sql<string>`COALESCE(SUM(${leads.estimatedValue} * ${leads.probability} / 100), 0)`,
      })
      .from(leads)
      .where(and(...leadConditions)),
  ]);

  const totalLeads = leadsCreated[0]?.count ?? 0;
  const wonCount = leadsWon[0]?.count ?? 0;
  const lostCount = leadsLost[0]?.count ?? 0;
  const closedLeads = wonCount + lostCount;
  const conversionRate = closedLeads > 0 ? (wonCount / closedLeads) * 100 : 0;

  return {
    period: {
      from: fromDate,
      to: toDate,
    },
    leads: {
      total: totalLeads,
      won: wonCount,
      lost: lostCount,
      open: totalLeads - closedLeads,
      conversionRate: Math.round(conversionRate * 100) / 100,
    },
    activities: {
      completed: activitiesCompleted[0]?.count ?? 0,
    },
    revenue: {
      totalValue: parseFloat(totalLeadValue[0]?.total || '0'),
      weightedValue: parseFloat(weightedValue[0]?.total || '0'),
    },
  };
}

// Pipeline analysis - value by stage
export async function getPipelineAnalysis(user: JWTPayload, filters: KPIFilter) {
  const conditions: SQL[] = [];

  if (!isAdmin(user)) {
    conditions.push(eq(leads.ownerId, user.userId));
  } else if (filters.userId) {
    conditions.push(eq(leads.ownerId, filters.userId));
  }

  // Exclude closed leads from pipeline
  conditions.push(
    sql`${leads.status} NOT IN ('gagne', 'perdu')`
  );

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const pipeline = await db
    .select({
      status: leads.status,
      count: count(),
      totalValue: sql<string>`COALESCE(SUM(${leads.estimatedValue}), 0)`,
      weightedValue: sql<string>`COALESCE(SUM(${leads.estimatedValue} * ${leads.probability} / 100), 0)`,
      avgProbability: sql<string>`COALESCE(AVG(${leads.probability}), 0)`,
    })
    .from(leads)
    .where(where)
    .groupBy(leads.status)
    .orderBy(leads.status);

  // Calculate totals
  const totals = pipeline.reduce(
    (acc, stage) => ({
      count: acc.count + (stage.count ?? 0),
      totalValue: acc.totalValue + parseFloat(stage.totalValue || '0'),
      weightedValue: acc.weightedValue + parseFloat(stage.weightedValue || '0'),
    }),
    { count: 0, totalValue: 0, weightedValue: 0 }
  );

  return {
    stages: pipeline.map((stage) => ({
      status: stage.status,
      count: stage.count ?? 0,
      totalValue: parseFloat(stage.totalValue || '0'),
      weightedValue: parseFloat(stage.weightedValue || '0'),
      avgProbability: Math.round(parseFloat(stage.avgProbability || '0')),
    })),
    totals,
  };
}

// Conversion analysis
export async function getConversionStats(user: JWTPayload, filters: KPIFilter) {
  const conditions: SQL[] = [];

  if (!isAdmin(user)) {
    conditions.push(eq(leads.ownerId, user.userId));
  } else if (filters.userId) {
    conditions.push(eq(leads.ownerId, filters.userId));
  }

  if (filters.fromDate) {
    conditions.push(gte(leads.createdAt, filters.fromDate));
  }

  if (filters.toDate) {
    conditions.push(lte(leads.createdAt, filters.toDate));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Get conversion by source
  const bySource = await db
    .select({
      source: leads.source,
      total: count(),
      won: sql<number>`SUM(CASE WHEN ${leads.status} = 'gagne' THEN 1 ELSE 0 END)`,
      lost: sql<number>`SUM(CASE WHEN ${leads.status} = 'perdu' THEN 1 ELSE 0 END)`,
      totalValue: sql<string>`SUM(CASE WHEN ${leads.status} = 'gagne' THEN ${leads.estimatedValue} ELSE 0 END)`,
    })
    .from(leads)
    .where(where)
    .groupBy(leads.source);

  // Overall conversion rate
  const overall = await db
    .select({
      total: count(),
      won: sql<number>`SUM(CASE WHEN ${leads.status} = 'gagne' THEN 1 ELSE 0 END)`,
      lost: sql<number>`SUM(CASE WHEN ${leads.status} = 'perdu' THEN 1 ELSE 0 END)`,
    })
    .from(leads)
    .where(where);

  const totalClosed = (overall[0]?.won ?? 0) + (overall[0]?.lost ?? 0);
  const overallRate = totalClosed > 0
    ? ((overall[0]?.won ?? 0) / totalClosed) * 100
    : 0;

  return {
    overall: {
      total: overall[0]?.total ?? 0,
      won: overall[0]?.won ?? 0,
      lost: overall[0]?.lost ?? 0,
      conversionRate: Math.round(overallRate * 100) / 100,
    },
    bySource: bySource.map((source) => {
      const closed = (source.won ?? 0) + (source.lost ?? 0);
      const rate = closed > 0 ? ((source.won ?? 0) / closed) * 100 : 0;
      return {
        source: source.source,
        total: source.total ?? 0,
        won: source.won ?? 0,
        lost: source.lost ?? 0,
        conversionRate: Math.round(rate * 100) / 100,
        revenue: parseFloat(source.totalValue || '0'),
      };
    }),
  };
}

// Revenue stats
export async function getRevenueStats(user: JWTPayload, filters: KPIFilter) {
  const conditions: SQL[] = [];

  if (!isAdmin(user)) {
    conditions.push(eq(leads.ownerId, user.userId));
  } else if (filters.userId) {
    conditions.push(eq(leads.ownerId, filters.userId));
  }

  // Only won leads
  conditions.push(eq(leads.status, 'gagne'));

  if (filters.fromDate) {
    conditions.push(gte(leads.convertedAt, filters.fromDate));
  }

  if (filters.toDate) {
    conditions.push(lte(leads.convertedAt, filters.toDate));
  }

  const where = and(...conditions);

  // Revenue by month
  const byMonth = await db
    .select({
      year: sql<number>`EXTRACT(YEAR FROM ${leads.convertedAt})`,
      month: sql<number>`EXTRACT(MONTH FROM ${leads.convertedAt})`,
      count: count(),
      revenue: sql<string>`COALESCE(SUM(${leads.estimatedValue}), 0)`,
    })
    .from(leads)
    .where(where)
    .groupBy(
      sql`EXTRACT(YEAR FROM ${leads.convertedAt})`,
      sql`EXTRACT(MONTH FROM ${leads.convertedAt})`
    )
    .orderBy(
      sql`EXTRACT(YEAR FROM ${leads.convertedAt})`,
      sql`EXTRACT(MONTH FROM ${leads.convertedAt})`
    );

  // Total revenue
  const total = await db
    .select({
      count: count(),
      revenue: sql<string>`COALESCE(SUM(${leads.estimatedValue}), 0)`,
    })
    .from(leads)
    .where(where);

  return {
    total: {
      deals: total[0]?.count ?? 0,
      revenue: parseFloat(total[0]?.revenue || '0'),
    },
    byMonth: byMonth.map((m) => ({
      year: m.year ?? 0,
      month: m.month ?? 0,
      deals: m.count ?? 0,
      revenue: parseFloat(m.revenue || '0'),
    })),
  };
}

// Activity metrics
export async function getActivityMetrics(user: JWTPayload, filters: KPIFilter) {
  const conditions: SQL[] = [];

  if (!isAdmin(user)) {
    conditions.push(eq(activities.ownerId, user.userId));
  } else if (filters.userId) {
    conditions.push(eq(activities.ownerId, filters.userId));
  }

  if (filters.fromDate) {
    conditions.push(gte(activities.createdAt, filters.fromDate));
  }

  if (filters.toDate) {
    conditions.push(lte(activities.createdAt, filters.toDate));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // By type
  const byType = await db
    .select({
      type: activities.type,
      total: count(),
      completed: sql<number>`SUM(CASE WHEN ${activities.status} = 'termine' THEN 1 ELSE 0 END)`,
      cancelled: sql<number>`SUM(CASE WHEN ${activities.status} = 'annule' THEN 1 ELSE 0 END)`,
      totalDuration: sql<number>`COALESCE(SUM(${activities.duration}), 0)`,
    })
    .from(activities)
    .where(where)
    .groupBy(activities.type);

  // By status
  const byStatus = await db
    .select({
      status: activities.status,
      count: count(),
    })
    .from(activities)
    .where(where)
    .groupBy(activities.status);

  return {
    byType: byType.map((t) => ({
      type: t.type,
      total: t.total ?? 0,
      completed: t.completed ?? 0,
      cancelled: t.cancelled ?? 0,
      totalDurationMinutes: t.totalDuration ?? 0,
    })),
    byStatus: byStatus.map((s) => ({
      status: s.status,
      count: s.count ?? 0,
    })),
  };
}

// Get objectives
export async function getObjectives(user: JWTPayload, filters: KPIFilter) {
  const conditions: SQL[] = [];

  if (!isAdmin(user)) {
    conditions.push(eq(salesObjectives.userId, user.userId));
  } else if (filters.userId) {
    conditions.push(eq(salesObjectives.userId, filters.userId));
  }

  if (filters.year) {
    conditions.push(eq(salesObjectives.year, filters.year));
  }

  if (filters.month) {
    conditions.push(eq(salesObjectives.month, filters.month));
  }

  if (filters.quarter) {
    conditions.push(eq(salesObjectives.quarter, filters.quarter));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const objectives = await db
    .select()
    .from(salesObjectives)
    .where(where)
    .orderBy(salesObjectives.year, salesObjectives.month);

  return objectives;
}

// Get objective with progress
export async function getObjectiveWithProgress(
  objectiveId: string,
  user: JWTPayload
) {
  const [objective] = await db
    .select()
    .from(salesObjectives)
    .where(eq(salesObjectives.id, objectiveId))
    .limit(1);

  if (!objective) {
    throw new NotFoundError('Objectif');
  }

  // Check access
  if (!isAdmin(user) && objective.userId !== user.userId) {
    throw new ForbiddenError('Accès non autorisé à cet objectif');
  }

  // Calculate date range for this objective
  let fromDate: Date;
  let toDate: Date;

  if (objective.month) {
    fromDate = new Date(objective.year, objective.month - 1, 1);
    toDate = new Date(objective.year, objective.month, 0, 23, 59, 59);
  } else if (objective.quarter) {
    const startMonth = (objective.quarter - 1) * 3;
    fromDate = new Date(objective.year, startMonth, 1);
    toDate = new Date(objective.year, startMonth + 3, 0, 23, 59, 59);
  } else {
    fromDate = new Date(objective.year, 0, 1);
    toDate = new Date(objective.year, 11, 31, 23, 59, 59);
  }

  // Get actual values
  const [leadsCount, conversionsCount, activitiesCount, revenue] =
    await Promise.all([
      // Leads created
      db
        .select({ count: count() })
        .from(leads)
        .where(
          and(
            eq(leads.ownerId, objective.userId),
            gte(leads.createdAt, fromDate),
            lte(leads.createdAt, toDate)
          )
        ),

      // Conversions
      db
        .select({ count: count() })
        .from(leads)
        .where(
          and(
            eq(leads.ownerId, objective.userId),
            eq(leads.status, 'gagne'),
            gte(leads.convertedAt, fromDate),
            lte(leads.convertedAt, toDate)
          )
        ),

      // Activities completed
      db
        .select({ count: count() })
        .from(activities)
        .where(
          and(
            eq(activities.ownerId, objective.userId),
            eq(activities.status, 'termine'),
            gte(activities.completedAt, fromDate),
            lte(activities.completedAt, toDate)
          )
        ),

      // Revenue from won leads
      db
        .select({
          total: sql<string>`COALESCE(SUM(${leads.estimatedValue}), 0)`,
        })
        .from(leads)
        .where(
          and(
            eq(leads.ownerId, objective.userId),
            eq(leads.status, 'gagne'),
            gte(leads.convertedAt, fromDate),
            lte(leads.convertedAt, toDate)
          )
        ),
    ]);

  const actualRevenue = parseFloat(revenue[0]?.total || '0');
  const actualLeads = leadsCount[0]?.count ?? 0;
  const actualConversions = conversionsCount[0]?.count ?? 0;
  const actualActivities = activitiesCount[0]?.count ?? 0;

  return {
    objective,
    period: { from: fromDate, to: toDate },
    progress: {
      revenue: {
        target: objective.revenueTarget ? parseFloat(objective.revenueTarget) : null,
        actual: actualRevenue,
        percentage: objective.revenueTarget
          ? Math.round((actualRevenue / parseFloat(objective.revenueTarget)) * 100)
          : null,
      },
      leads: {
        target: objective.leadsTarget,
        actual: actualLeads,
        percentage: objective.leadsTarget
          ? Math.round((actualLeads / objective.leadsTarget) * 100)
          : null,
      },
      conversions: {
        target: objective.conversionsTarget,
        actual: actualConversions,
        percentage: objective.conversionsTarget
          ? Math.round((actualConversions / objective.conversionsTarget) * 100)
          : null,
      },
      activities: {
        target: objective.activitiesTarget,
        actual: actualActivities,
        percentage: objective.activitiesTarget
          ? Math.round((actualActivities / objective.activitiesTarget) * 100)
          : null,
      },
    },
  };
}

// Create or update objective (admin only)
export async function upsertObjective(input: SalesObjectiveInput, user: JWTPayload) {
  if (!isAdmin(user)) {
    throw new ForbiddenError('Seuls les administrateurs peuvent définir des objectifs');
  }

  // Check for existing objective
  const conditions: SQL[] = [
    eq(salesObjectives.userId, input.userId),
    eq(salesObjectives.year, input.year),
  ];

  if (input.month) {
    conditions.push(eq(salesObjectives.month, input.month));
  } else {
    conditions.push(sql`${salesObjectives.month} IS NULL`);
  }

  if (input.quarter) {
    conditions.push(eq(salesObjectives.quarter, input.quarter));
  } else {
    conditions.push(sql`${salesObjectives.quarter} IS NULL`);
  }

  const [existing] = await db
    .select({ id: salesObjectives.id })
    .from(salesObjectives)
    .where(and(...conditions))
    .limit(1);

  if (existing) {
    // Update
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (input.revenueTarget !== undefined) updateData.revenueTarget = input.revenueTarget?.toString() || null;
    if (input.leadsTarget !== undefined) updateData.leadsTarget = input.leadsTarget;
    if (input.conversionsTarget !== undefined) updateData.conversionsTarget = input.conversionsTarget;
    if (input.activitiesTarget !== undefined) updateData.activitiesTarget = input.activitiesTarget;

    const [objective] = await db
      .update(salesObjectives)
      .set(updateData)
      .where(eq(salesObjectives.id, existing.id))
      .returning();
    return objective;
  } else {
    // Create
    const [objective] = await db
      .insert(salesObjectives)
      .values({
        userId: input.userId,
        year: input.year,
        month: input.month || null,
        quarter: input.quarter || null,
        revenueTarget: input.revenueTarget?.toString() || null,
        leadsTarget: input.leadsTarget || null,
        conversionsTarget: input.conversionsTarget || null,
        activitiesTarget: input.activitiesTarget || null,
      })
      .returning();
    return objective;
  }
}

// Appointment KPIs
export async function getAppointmentKPIs(user: JWTPayload, filters: KPIFilter) {
  const conditions: SQL[] = [];

  // RBAC: non-admin sees only their own appointments
  if (!isAdmin(user)) {
    conditions.push(eq(appointments.organizerId, user.userId));
  } else if (filters.userId) {
    conditions.push(eq(appointments.organizerId, filters.userId));
  }

  if (filters.fromDate) {
    conditions.push(gte(appointments.scheduledAt, filters.fromDate));
  }

  if (filters.toDate) {
    conditions.push(lte(appointments.scheduledAt, filters.toDate));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult, byStatus, byType, avgDurationResult] = await Promise.all([
    // Total count
    db.select({ count: count() }).from(appointments).where(where),

    // By status
    db
      .select({
        status: appointments.status,
        count: count(),
      })
      .from(appointments)
      .where(where)
      .groupBy(appointments.status),

    // By type
    db
      .select({
        type: appointments.type,
        count: count(),
      })
      .from(appointments)
      .where(where)
      .groupBy(appointments.type),

    // Average duration of completed appointments
    db
      .select({
        avg: sql<string>`COALESCE(AVG(${appointments.duration}), 0)`,
      })
      .from(appointments)
      .where(
        conditions.length > 0
          ? and(...conditions, eq(appointments.status, 'termine'))
          : eq(appointments.status, 'termine')
      ),
  ]);

  const total = totalResult[0]?.count ?? 0;
  const completed = byStatus.find((s) => s.status === 'termine')?.count ?? 0;
  const noShow = byStatus.find((s) => s.status === 'no_show')?.count ?? 0;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const noShowRate = total > 0 ? Math.round((noShow / total) * 100) : 0;

  // Per week (appointments in the last 4 weeks / 4)
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  const weeklyConditions = [...conditions, gte(appointments.scheduledAt, fourWeeksAgo)];
  const weeklyResult = await db
    .select({ count: count() })
    .from(appointments)
    .where(and(...weeklyConditions));
  const perWeek = Math.round((weeklyResult[0]?.count ?? 0) / 4);

  return {
    total,
    byStatus: byStatus.map((s) => ({ status: s.status, count: s.count ?? 0 })),
    byType: byType.map((t) => ({ type: t.type, count: t.count ?? 0 })),
    completionRate,
    noShowRate,
    avgDuration: Math.round(parseFloat(avgDurationResult[0]?.avg || '0')),
    perWeek,
  };
}

// Delete objective (admin only)
export async function deleteObjective(id: string, user: JWTPayload) {
  if (!isAdmin(user)) {
    throw new ForbiddenError('Seuls les administrateurs peuvent supprimer des objectifs');
  }

  const [existing] = await db
    .select({ id: salesObjectives.id })
    .from(salesObjectives)
    .where(eq(salesObjectives.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Objectif');
  }

  await db.delete(salesObjectives).where(eq(salesObjectives.id, id));
}

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { kpiFilterSchema, salesObjectiveSchema } from './kpis.schema';
import * as kpisService from './kpis.service';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireCRMAccess, requireAdmin } from '../../middleware/rbac.middleware';
import type { JWTPayload } from '../../middleware/auth.middleware';

const kpisRouter = new Hono();

// Apply auth and CRM access middleware
kpisRouter.use('*', authMiddleware, requireCRMAccess());

// GET /api/kpis/dashboard - Dashboard overview
kpisRouter.get(
  '/dashboard',
  zValidator('query', kpiFilterSchema),
  async (c) => {
    const filters = c.req.valid('query');
    const user = c.get('user') as JWTPayload;
    const data = await kpisService.getDashboardData(user, filters);
    return c.json(data);
  }
);

// GET /api/kpis/pipeline - Pipeline analysis
kpisRouter.get(
  '/pipeline',
  zValidator('query', kpiFilterSchema),
  async (c) => {
    const filters = c.req.valid('query');
    const user = c.get('user') as JWTPayload;
    const data = await kpisService.getPipelineAnalysis(user, filters);
    return c.json(data);
  }
);

// GET /api/kpis/conversions - Conversion stats
kpisRouter.get(
  '/conversions',
  zValidator('query', kpiFilterSchema),
  async (c) => {
    const filters = c.req.valid('query');
    const user = c.get('user') as JWTPayload;
    const data = await kpisService.getConversionStats(user, filters);
    return c.json(data);
  }
);

// GET /api/kpis/revenue - Revenue stats
kpisRouter.get(
  '/revenue',
  zValidator('query', kpiFilterSchema),
  async (c) => {
    const filters = c.req.valid('query');
    const user = c.get('user') as JWTPayload;
    const data = await kpisService.getRevenueStats(user, filters);
    return c.json(data);
  }
);

// GET /api/kpis/activities - Activity metrics
kpisRouter.get(
  '/activities',
  zValidator('query', kpiFilterSchema),
  async (c) => {
    const filters = c.req.valid('query');
    const user = c.get('user') as JWTPayload;
    const data = await kpisService.getActivityMetrics(user, filters);
    return c.json(data);
  }
);

// GET /api/kpis/appointments - Appointment metrics
kpisRouter.get(
  '/appointments',
  zValidator('query', kpiFilterSchema),
  async (c) => {
    const filters = c.req.valid('query');
    const user = c.get('user') as JWTPayload;
    const data = await kpisService.getAppointmentKPIs(user, filters);
    return c.json(data);
  }
);

// GET /api/kpis/objectives - List objectives
kpisRouter.get(
  '/objectives',
  zValidator('query', kpiFilterSchema),
  async (c) => {
    const filters = c.req.valid('query');
    const user = c.get('user') as JWTPayload;
    const objectives = await kpisService.getObjectives(user, filters);
    return c.json(objectives);
  }
);

// GET /api/kpis/objectives/:id - Get objective with progress
kpisRouter.get('/objectives/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user') as JWTPayload;
  const data = await kpisService.getObjectiveWithProgress(id, user);
  return c.json(data);
});

// POST /api/kpis/objectives - Create or update objective (admin only)
kpisRouter.post(
  '/objectives',
  requireAdmin(),
  zValidator('json', salesObjectiveSchema),
  async (c) => {
    const input = c.req.valid('json');
    const user = c.get('user') as JWTPayload;
    const objective = await kpisService.upsertObjective(input, user);
    return c.json(objective, 201);
  }
);

// DELETE /api/kpis/objectives/:id - Delete objective (admin only)
kpisRouter.delete('/objectives/:id', requireAdmin(), async (c) => {
  const id = c.req.param('id') as string;
  const user = c.get('user') as JWTPayload;
  await kpisService.deleteObjective(id, user);
  return c.json({ message: 'Objectif supprimé' });
});

export default kpisRouter;

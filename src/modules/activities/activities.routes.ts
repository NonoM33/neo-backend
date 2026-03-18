import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  createActivitySchema,
  updateActivitySchema,
  completeActivitySchema,
  activityFilterSchema,
} from './activities.schema';
import * as activitiesService from './activities.service';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireCRMAccess } from '../../middleware/rbac.middleware';
import { paginationSchema } from '../../lib/pagination';
import type { JWTPayload } from '../../middleware/auth.middleware';

const activitiesRouter = new Hono();

// Apply auth and CRM access middleware
activitiesRouter.use('*', authMiddleware, requireCRMAccess());

// GET /api/activities - List activities with filters
activitiesRouter.get(
  '/',
  zValidator('query', paginationSchema.merge(activityFilterSchema)),
  async (c) => {
    const query = c.req.valid('query');
    const { page, limit, ...filters } = query;
    const user = c.get('user') as JWTPayload;
    const result = await activitiesService.getActivities({ page, limit }, filters, user);
    return c.json(result);
  }
);

// GET /api/activities/upcoming - Upcoming activities and reminders
activitiesRouter.get(
  '/upcoming',
  zValidator('query', z.object({ days: z.coerce.number().int().min(1).max(30).default(7) })),
  async (c) => {
    const { days } = c.req.valid('query');
    const user = c.get('user') as JWTPayload;
    const result = await activitiesService.getUpcomingActivities(user, days);
    return c.json(result);
  }
);

// GET /api/activities/:id - Get activity by ID
activitiesRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user') as JWTPayload;
  const activity = await activitiesService.getActivityById(id, user);
  return c.json(activity);
});

// POST /api/activities - Create activity
activitiesRouter.post('/', zValidator('json', createActivitySchema), async (c) => {
  const input = c.req.valid('json');
  const user = c.get('user') as JWTPayload;
  const activity = await activitiesService.createActivity(input, user);
  return c.json(activity, 201);
});

// PUT /api/activities/:id - Update activity
activitiesRouter.put('/:id', zValidator('json', updateActivitySchema), async (c) => {
  const id = c.req.param('id');
  const input = c.req.valid('json');
  const user = c.get('user') as JWTPayload;
  const activity = await activitiesService.updateActivity(id, input, user);
  return c.json(activity);
});

// POST /api/activities/:id/complete - Mark activity as completed
activitiesRouter.post(
  '/:id/complete',
  zValidator('json', completeActivitySchema),
  async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const user = c.get('user') as JWTPayload;
    const activity = await activitiesService.completeActivity(id, input, user);
    return c.json(activity);
  }
);

// POST /api/activities/:id/cancel - Cancel activity
activitiesRouter.post('/:id/cancel', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user') as JWTPayload;
  const activity = await activitiesService.cancelActivity(id, user);
  return c.json(activity);
});

// DELETE /api/activities/:id - Delete activity
activitiesRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user') as JWTPayload;
  await activitiesService.deleteActivity(id, user);
  return c.json({ message: 'Activité supprimée' });
});

export default activitiesRouter;

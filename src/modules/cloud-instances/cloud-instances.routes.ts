import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  createCloudInstanceSchema,
  updateCloudInstanceSchema,
  heartbeatSchema,
  instanceFilterSchema,
} from './cloud-instances.schema';
import * as cloudService from './cloud-instances.service';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/rbac.middleware';
import { paginationSchema } from '../../lib/pagination';

const cloudInstancesRouter = new Hono();

// ============ Public Routes (heartbeat from HA instances) ============

cloudInstancesRouter.post(
  '/heartbeat',
  zValidator('json', heartbeatSchema),
  async (c) => {
    const input = c.req.valid('json');
    const result = await cloudService.handleHeartbeat(input);
    return c.json(result);
  },
);

// ============ Protected Routes (admin only) ============

cloudInstancesRouter.use('/*', authMiddleware, requireAdmin());

// GET / - List all instances
cloudInstancesRouter.get(
  '/',
  zValidator('query', paginationSchema.merge(instanceFilterSchema)),
  async (c) => {
    const { page, limit, ...filters } = c.req.valid('query');
    const result = await cloudService.getInstances({ page, limit }, filters);
    return c.json(result);
  },
);

// GET /stats - Dashboard stats
cloudInstancesRouter.get('/stats', async (c) => {
  const stats = await cloudService.getCloudStats();
  return c.json(stats);
});

// GET /:id - Instance detail
cloudInstancesRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const instance = await cloudService.getInstanceById(id);
  return c.json(instance);
});

// GET /:id/status - Live status (Docker + DB)
cloudInstancesRouter.get('/:id/status', async (c) => {
  const id = c.req.param('id');
  const status = await cloudService.getInstanceStatus(id);
  return c.json(status);
});

// GET /:id/logs - Container logs
cloudInstancesRouter.get('/:id/logs', async (c) => {
  const id = c.req.param('id');
  const lines = Number(c.req.query('lines') || '100');
  const logs = await cloudService.getInstanceLogs(id, lines);
  return c.json(logs);
});

// POST / - Provision new instance
cloudInstancesRouter.post(
  '/',
  zValidator('json', createCloudInstanceSchema),
  async (c) => {
    const input = c.req.valid('json');
    const instance = await cloudService.provisionInstance(input);
    return c.json(instance, 201);
  },
);

// PUT /:id - Update instance config
cloudInstancesRouter.put(
  '/:id',
  zValidator('json', updateCloudInstanceSchema),
  async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const instance = await cloudService.updateInstance(id, input);
    return c.json(instance);
  },
);

// POST /:id/start - Start instance
cloudInstancesRouter.post('/:id/start', async (c) => {
  const id = c.req.param('id');
  const result = await cloudService.startInstance(id);
  return c.json(result);
});

// POST /:id/stop - Stop instance
cloudInstancesRouter.post('/:id/stop', async (c) => {
  const id = c.req.param('id');
  const result = await cloudService.stopInstance(id);
  return c.json(result);
});

// POST /:id/restart - Restart instance
cloudInstancesRouter.post('/:id/restart', async (c) => {
  const id = c.req.param('id');
  const result = await cloudService.restartInstance(id);
  return c.json(result);
});

// DELETE /:id - Destroy instance
cloudInstancesRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const result = await cloudService.destroyInstance(id);
  return c.json(result);
});

export default cloudInstancesRouter;

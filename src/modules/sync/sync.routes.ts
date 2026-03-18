import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { syncPushSchema, syncPullSchema } from './sync.schema';
import * as syncService from './sync.service';
import { authMiddleware } from '../../middleware/auth.middleware';
import type { JWTPayload } from '../../middleware/auth.middleware';

const syncRouter = new Hono();

syncRouter.use('*', authMiddleware);

// Get sync status
syncRouter.get('/status', async (c) => {
  const userId = c.get('userId');
  const status = await syncService.getSyncStatus(userId);
  return c.json(status);
});

// Pull changes from server
syncRouter.post('/pull', zValidator('json', syncPullSchema), async (c) => {
  const userId = c.get('userId');
  const user = c.get('user') as JWTPayload;
  const input = c.req.valid('json');
  const result = await syncService.pullChanges(userId, input, user);
  return c.json(result);
});

// Push changes to server
syncRouter.post('/push', zValidator('json', syncPushSchema), async (c) => {
  const userId = c.get('userId');
  const user = c.get('user') as JWTPayload;
  const input = c.req.valid('json');
  const result = await syncService.pushChanges(userId, input, user);
  return c.json(result);
});

export default syncRouter;

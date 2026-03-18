import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  createRoomSchema,
  updateRoomSchema,
  createChecklistItemSchema,
  updateChecklistItemSchema,
} from './rooms.schema';
import * as roomsService from './rooms.service';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireIntegrateurOrAdmin } from '../../middleware/rbac.middleware';

const roomsRouter = new Hono();

roomsRouter.use('*', authMiddleware, requireIntegrateurOrAdmin());

// Get rooms by project
roomsRouter.get('/projets/:projectId/pieces', async (c) => {
  const projectId = c.req.param('projectId');
  const user = c.get('user');
  const roomsList = await roomsService.getRoomsByProject(projectId, user.userId, user.role);
  return c.json(roomsList);
});

// Create room
roomsRouter.post(
  '/projets/:projectId/pieces',
  zValidator('json', createRoomSchema),
  async (c) => {
    const projectId = c.req.param('projectId');
    const input = c.req.valid('json');
    const user = c.get('user');
    const room = await roomsService.createRoom(projectId, input, user.userId, user.role);
    return c.json(room, 201);
  }
);

// Get room by ID
roomsRouter.get('/pieces/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const room = await roomsService.getRoomById(id, user.userId, user.role);
  return c.json(room);
});

// Update room
roomsRouter.put('/pieces/:id', zValidator('json', updateRoomSchema), async (c) => {
  const id = c.req.param('id');
  const input = c.req.valid('json');
  const user = c.get('user');
  const room = await roomsService.updateRoom(id, input, user.userId, user.role);
  return c.json(room);
});

// Delete room
roomsRouter.delete('/pieces/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  await roomsService.deleteRoom(id, user.userId, user.role);
  return c.json({ message: 'Pièce supprimée' });
});

// ============ Checklist Items ============

roomsRouter.post(
  '/pieces/:roomId/checklist',
  zValidator('json', createChecklistItemSchema),
  async (c) => {
    const roomId = c.req.param('roomId');
    const input = c.req.valid('json');
    const user = c.get('user');
    const item = await roomsService.createChecklistItem(roomId, input, user.userId, user.role);
    return c.json(item, 201);
  }
);

roomsRouter.put(
  '/checklist/:id',
  zValidator('json', updateChecklistItemSchema),
  async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const user = c.get('user');
    const item = await roomsService.updateChecklistItem(id, input, user.userId, user.role);
    return c.json(item);
  }
);

roomsRouter.delete('/checklist/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  await roomsService.deleteChecklistItem(id, user.userId, user.role);
  return c.json({ message: 'Item supprimé' });
});

export default roomsRouter;

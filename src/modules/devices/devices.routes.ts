import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createDeviceSchema, updateDeviceSchema } from './devices.schema';
import * as devicesService from './devices.service';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireIntegrateurOrAdmin } from '../../middleware/rbac.middleware';

const devicesRouter = new Hono();

devicesRouter.use('*', authMiddleware, requireIntegrateurOrAdmin());

// Get devices by project
devicesRouter.get('/projets/:projectId/devices', async (c) => {
  const projectId = c.req.param('projectId');
  const user = c.get('user');
  const devicesList = await devicesService.getDevicesByProject(projectId, user.userId, user.role);
  return c.json(devicesList);
});

// Get devices by room
devicesRouter.get('/pieces/:roomId/devices', async (c) => {
  const roomId = c.req.param('roomId');
  const user = c.get('user');
  const devicesList = await devicesService.getDevicesByRoom(roomId, user.userId, user.role);
  return c.json(devicesList);
});

// Create device in a room
devicesRouter.post(
  '/pieces/:roomId/devices',
  zValidator('json', createDeviceSchema),
  async (c) => {
    const roomId = c.req.param('roomId');
    const input = c.req.valid('json');
    const user = c.get('user');
    const device = await devicesService.createDevice(roomId, input, user.userId, user.role);
    return c.json(device, 201);
  }
);

// Get device by ID
devicesRouter.get('/devices/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const device = await devicesService.getDeviceById(id, user.userId, user.role);
  return c.json(device);
});

// Update device
devicesRouter.put('/devices/:id', zValidator('json', updateDeviceSchema), async (c) => {
  const id = c.req.param('id');
  const input = c.req.valid('json');
  const user = c.get('user');
  const device = await devicesService.updateDevice(id, input, user.userId, user.role);
  return c.json(device);
});

// Delete device
devicesRouter.delete('/devices/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  await devicesService.deleteDevice(id, user.userId, user.role);
  return c.json({ message: 'Device supprimé' });
});

export default devicesRouter;

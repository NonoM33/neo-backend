import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  setAvailabilitySchema,
  availabilityOverrideSchema,
  availableSlotsQuerySchema,
} from './appointments.schema';
import * as appointmentsService from './appointments.service';
import { authMiddleware } from '../../middleware/auth.middleware';
import type { JWTPayload } from '../../middleware/auth.middleware';

const availabilityRouter = new Hono();

// Apply auth middleware - all authenticated users can manage their availability
availabilityRouter.use('*', authMiddleware);

// GET /api/availability/:userId - Get availability for a user
availabilityRouter.get('/:userId', async (c) => {
  const userId = c.req.param('userId');
  const result = await appointmentsService.getAvailability(userId);
  return c.json(result);
});

// PUT /api/availability - Set availability (bulk replace for current user)
availabilityRouter.put(
  '/',
  zValidator('json', setAvailabilitySchema),
  async (c) => {
    const input = c.req.valid('json');
    const user = c.get('user') as JWTPayload;
    const slots = await appointmentsService.setAvailability(user.userId, input);
    return c.json(slots);
  }
);

// GET /api/availability/:userId/slots - Get available time slots for a user
availabilityRouter.get(
  '/:userId/slots',
  zValidator('query', availableSlotsQuerySchema),
  async (c) => {
    const userId = c.req.param('userId');
    const query = c.req.valid('query');
    const slots = await appointmentsService.getAvailableSlots(
      userId,
      query.fromDate,
      query.toDate,
      query.duration
    );
    return c.json(slots);
  }
);

// POST /api/availability/overrides - Add availability override for current user
availabilityRouter.post(
  '/overrides',
  zValidator('json', availabilityOverrideSchema),
  async (c) => {
    const input = c.req.valid('json');
    const user = c.get('user') as JWTPayload;
    const override = await appointmentsService.addAvailabilityOverride(user.userId, input);
    return c.json(override, 201);
  }
);

// DELETE /api/availability/overrides/:id - Delete availability override
availabilityRouter.delete('/overrides/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user') as JWTPayload;
  await appointmentsService.deleteAvailabilityOverride(id, user.userId);
  return c.json({ message: 'Exception de disponibilité supprimée' });
});

export default availabilityRouter;

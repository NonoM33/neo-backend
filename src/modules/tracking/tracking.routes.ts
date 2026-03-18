import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../../middleware/auth.middleware';
import { startTrackingSchema, updateLocationSchema } from './tracking.schema';
import * as trackingService from './tracking.service';

const trackingRouter = new Hono();

// All routes require authentication
trackingRouter.use('*', authMiddleware);

// ─── POST /api/tracking/start ───────────────────────────────────────────────
// Start a new tracking session for an appointment
trackingRouter.post(
  '/start',
  zValidator('json', startTrackingSchema),
  async (c) => {
    const input = c.req.valid('json');
    const userId = c.get('userId');

    const result = await trackingService.startTracking(input, userId);

    return c.json({
      session: {
        id: result.session.id,
        status: result.session.status,
        etaMinutes: result.session.etaMinutes,
        expiresAt: result.session.expiresAt,
      },
      trackingUrl: result.trackingUrl,
      smsSent: result.smsSent,
    }, 201);
  }
);

// ─── PUT /api/tracking/:id/location ─────────────────────────────────────────
// Update auditor's current location
trackingRouter.put(
  '/:id/location',
  zValidator('json', updateLocationSchema),
  async (c) => {
    const sessionId = c.req.param('id');
    const input = c.req.valid('json');
    const userId = c.get('userId');

    const result = await trackingService.updateLocation(sessionId, input, userId);

    return c.json({
      status: result.session.status,
      etaMinutes: result.etaMinutes,
    });
  }
);

// ─── POST /api/tracking/:id/arrive ──────────────────────────────────────────
// Mark auditor as arrived at destination
trackingRouter.post('/:id/arrive', async (c) => {
  const sessionId = c.req.param('id');
  const userId = c.get('userId');

  const session = await trackingService.markArrived(sessionId, userId);

  return c.json({
    status: session.status,
    arrivedAt: session.arrivedAt,
  });
});

// ─── POST /api/tracking/:id/cancel ──────────────────────────────────────────
// Cancel tracking session
trackingRouter.post('/:id/cancel', async (c) => {
  const sessionId = c.req.param('id');
  const userId = c.get('userId');

  const session = await trackingService.cancelTracking(sessionId, userId);

  return c.json({
    status: session.status,
  });
});

// ─── GET /api/tracking/active ───────────────────────────────────────────────
// Get all active tracking sessions for the current auditor
trackingRouter.get('/active', async (c) => {
  const userId = c.get('userId');

  const sessions = await trackingService.getActiveSessions(userId);

  return c.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      appointmentId: s.appointmentId,
      status: s.status,
      etaMinutes: s.etaMinutes,
      startedAt: s.startedAt,
      expiresAt: s.expiresAt,
    })),
  });
});

export default trackingRouter;

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { publicSlotsQuerySchema, publicBookingSchema } from './booking.schema';
import * as bookingService from './booking.service';
import { rateLimit } from '../../middleware/rate-limit.middleware';

const bookingRouter = new Hono();

// ─── Rate limiting (per-endpoint) ────────────────────────────────────────────
bookingRouter.use('/types', rateLimit({ maxRequests: 60, windowMs: 60_000 }));
bookingRouter.use('/slots', rateLimit({ maxRequests: 30, windowMs: 60_000 }));
bookingRouter.use('/', rateLimit({ maxRequests: 5, windowMs: 60_000 }));

// ─── GET /api/public/booking/types ───────────────────────────────────────────
bookingRouter.get('/types', async (c) => {
  const types = await bookingService.getPublicAppointmentTypes();
  return c.json({ types });
});

// ─── GET /api/public/booking/slots ───────────────────────────────────────────
bookingRouter.get(
  '/slots',
  zValidator('query', publicSlotsQuerySchema),
  async (c) => {
    const { type, fromDate, toDate } = c.req.valid('query');
    const slots = await bookingService.getAggregatedSlots(type, fromDate, toDate);
    return c.json({ slots });
  }
);

// ─── POST /api/public/booking ────────────────────────────────────────────────
bookingRouter.post(
  '/',
  zValidator('json', publicBookingSchema),
  async (c) => {
    const input = c.req.valid('json');
    const result = await bookingService.createPublicBooking(input);
    return c.json(result, 201);
  }
);

// ─── GET /api/public/booking/rdv/:token ──────────────────────────────────────
// Public appointment detail (no auth, uses token)
bookingRouter.get('/rdv/:token', async (c) => {
  const token = c.req.param('token');
  const appt = await bookingService.getAppointmentByToken(token);
  if (!appt) {
    return c.json({ error: { message: 'Rendez-vous introuvable', code: 'NOT_FOUND' } }, 404);
  }
  return c.json(appt);
});

// ─── POST /api/public/booking/rdv/:token/cancel ─────────────────────────────
bookingRouter.post(
  '/rdv/:token/cancel',
  zValidator('json', z.object({ reason: z.string().optional() })),
  async (c) => {
    const token = c.req.param('token');
    const { reason } = c.req.valid('json');
    const result = await bookingService.cancelAppointmentByToken(token, reason);
    return c.json(result);
  }
);

// ─── POST /api/public/booking/rdv/:token/reschedule ─────────────────────────
bookingRouter.post(
  '/rdv/:token/reschedule',
  zValidator('json', z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
  })),
  async (c) => {
    const token = c.req.param('token');
    const { date, startTime } = c.req.valid('json');
    const result = await bookingService.rescheduleAppointmentByToken(token, date, startTime);
    return c.json(result);
  }
);

// ─── GET /api/public/booking/rdv/:token/slots ───────────────────────────────
// Available slots for rescheduling
bookingRouter.get(
  '/rdv/:token/slots',
  async (c) => {
    const token = c.req.param('token');
    const appt = await bookingService.getAppointmentByToken(token);
    if (!appt) return c.json({ error: { message: 'Introuvable', code: 'NOT_FOUND' } }, 404);

    const fromDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const toDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const slots = await bookingService.getAggregatedSlots(appt.type as any, fromDate, toDate);
    return c.json({ slots });
  }
);

// ─── POST /api/public/booking/reminders ──────────────────────────────────────
// Trigger reminder check (called by cron every 5 minutes)
bookingRouter.post('/reminders', async (c) => {
  const result = await bookingService.sendReminders();
  return c.json(result);
});

export default bookingRouter;

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  createAppointmentSchema,
  updateAppointmentSchema,
  appointmentFilterSchema,
  completeAppointmentSchema,
  cancelAppointmentSchema,
  createRecurringSchema,
  addParticipantSchema,
  respondToInvitationSchema,
  updateTypeConfigSchema,
  updateAuditSchema,
} from './appointments.schema';
import * as appointmentsService from './appointments.service';
import { authMiddleware } from '../../middleware/auth.middleware';
import { paginationSchema } from '../../lib/pagination';
import type { JWTPayload } from '../../middleware/auth.middleware';

const appointmentsRouter = new Hono();

// Apply auth middleware - all authenticated users can access appointments
appointmentsRouter.use('*', authMiddleware);

// GET /api/appointments - List appointments (fromDate and toDate required)
appointmentsRouter.get(
  '/',
  zValidator('query', paginationSchema.merge(appointmentFilterSchema)),
  async (c) => {
    const query = c.req.valid('query');
    const { page, limit, ...filters } = query;
    const user = c.get('user') as JWTPayload;
    const result = await appointmentsService.getAppointments({ page, limit }, filters, user);
    return c.json(result);
  }
);

// GET /api/appointments/types - Get type configs
appointmentsRouter.get('/types', async (c) => {
  const configs = await appointmentsService.getTypeConfigs();
  return c.json(configs);
});

// GET /api/appointments/kpis - Get appointment KPIs
appointmentsRouter.get('/kpis', async (c) => {
  const user = c.get('user') as JWTPayload;
  const fromDate = c.req.query('fromDate');
  const toDate = c.req.query('toDate');
  const filters: { fromDate?: Date; toDate?: Date } = {};
  if (fromDate) filters.fromDate = new Date(fromDate);
  if (toDate) filters.toDate = new Date(toDate);
  const kpis = await appointmentsService.getAppointmentKPIs(user, filters);
  return c.json(kpis);
});

// GET /api/appointments/:id - Get appointment by ID
appointmentsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user') as JWTPayload;
  const appointment = await appointmentsService.getAppointmentById(id, user);
  return c.json(appointment);
});

// POST /api/appointments - Create appointment
appointmentsRouter.post(
  '/',
  zValidator('json', createAppointmentSchema),
  async (c) => {
    const input = c.req.valid('json');
    const user = c.get('user') as JWTPayload;
    const appointment = await appointmentsService.createAppointment(input, user);
    return c.json(appointment, 201);
  }
);

// PUT /api/appointments/:id - Update appointment
appointmentsRouter.put(
  '/:id',
  zValidator('json', updateAppointmentSchema),
  async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const user = c.get('user') as JWTPayload;
    const appointment = await appointmentsService.updateAppointment(id, input, user);
    return c.json(appointment);
  }
);

// DELETE /api/appointments/:id - Delete appointment
appointmentsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user') as JWTPayload;
  await appointmentsService.deleteAppointment(id, user);
  return c.json({ message: 'Rendez-vous supprimé' });
});

// PUT /api/appointments/:id/audit - Update audit data (deep-merge into metadata)
appointmentsRouter.put(
  '/:id/audit',
  zValidator('json', updateAuditSchema),
  async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const user = c.get('user') as JWTPayload;
    const appointment = await appointmentsService.updateAuditData(id, input, user);
    return c.json(appointment);
  }
);

// POST /api/appointments/:id/confirm - Confirm appointment
appointmentsRouter.post('/:id/confirm', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user') as JWTPayload;
  const appointment = await appointmentsService.confirmAppointment(id, user);
  return c.json(appointment);
});

// POST /api/appointments/:id/start - Start appointment
appointmentsRouter.post('/:id/start', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user') as JWTPayload;
  const appointment = await appointmentsService.startAppointment(id, user);
  return c.json(appointment);
});

// POST /api/appointments/:id/complete - Complete appointment
appointmentsRouter.post(
  '/:id/complete',
  zValidator('json', completeAppointmentSchema),
  async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const user = c.get('user') as JWTPayload;
    const appointment = await appointmentsService.completeAppointment(id, input, user);
    return c.json(appointment);
  }
);

// POST /api/appointments/:id/cancel - Cancel appointment
appointmentsRouter.post(
  '/:id/cancel',
  zValidator('json', cancelAppointmentSchema),
  async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const user = c.get('user') as JWTPayload;
    const appointment = await appointmentsService.cancelAppointment(id, input, user);
    return c.json(appointment);
  }
);

// POST /api/appointments/:id/no-show - Mark as no-show
appointmentsRouter.post('/:id/no-show', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user') as JWTPayload;
  const appointment = await appointmentsService.markNoShow(id, user);
  return c.json(appointment);
});

// POST /api/appointments/:id/participants - Add participant
appointmentsRouter.post(
  '/:id/participants',
  zValidator('json', addParticipantSchema),
  async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const user = c.get('user') as JWTPayload;
    const participant = await appointmentsService.addParticipant(
      id,
      input.userId,
      input.role,
      user
    );
    return c.json(participant, 201);
  }
);

// DELETE /api/appointments/:id/participants/:userId - Remove participant
appointmentsRouter.delete('/:id/participants/:userId', async (c) => {
  const id = c.req.param('id');
  const userId = c.req.param('userId');
  const user = c.get('user') as JWTPayload;
  await appointmentsService.removeParticipant(id, userId, user);
  return c.json({ message: 'Participant retiré' });
});

// POST /api/appointments/:id/participants/:userId/respond - Respond to invitation
appointmentsRouter.post(
  '/:id/participants/:userId/respond',
  zValidator('json', respondToInvitationSchema),
  async (c) => {
    const id = c.req.param('id');
    const userId = c.req.param('userId');
    const input = c.req.valid('json');
    const participant = await appointmentsService.respondToInvitation(id, userId, input.status);
    return c.json(participant);
  }
);

// PUT /api/appointments/types/:type - Update type config (admin only)
appointmentsRouter.put(
  '/types/:type',
  zValidator('json', updateTypeConfigSchema),
  async (c) => {
    const type = c.req.param('type');
    const input = c.req.valid('json');
    const user = c.get('user') as JWTPayload;
    const config = await appointmentsService.updateTypeConfig(type, input, user);
    return c.json(config);
  }
);

// POST /api/appointments/recurring - Create recurring appointment
appointmentsRouter.post(
  '/recurring',
  zValidator('json', createRecurringSchema),
  async (c) => {
    const input = c.req.valid('json');
    const user = c.get('user') as JWTPayload;
    const result = await appointmentsService.createRecurringAppointment(input, user);
    return c.json(result, 201);
  }
);

// PUT /api/appointments/:id/this - Update single occurrence
appointmentsRouter.put(
  '/:id/this',
  zValidator('json', updateAppointmentSchema),
  async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const user = c.get('user') as JWTPayload;
    const appointment = await appointmentsService.updateSingleOccurrence(id, input, user);
    return c.json(appointment);
  }
);

// PUT /api/appointments/:id/following - Update following occurrences
appointmentsRouter.put(
  '/:id/following',
  zValidator('json', updateAppointmentSchema),
  async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const user = c.get('user') as JWTPayload;
    const result = await appointmentsService.updateFollowingOccurrences(id, input, user);
    return c.json(result);
  }
);

// DELETE /api/appointments/:id/series - Delete entire series
appointmentsRouter.delete('/:id/series', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user') as JWTPayload;
  await appointmentsService.deleteRecurrenceSeries(id, user);
  return c.json({ message: 'Série de rendez-vous supprimée' });
});

export default appointmentsRouter;

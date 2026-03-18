import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireCRMAccess } from '../../middleware/rbac.middleware';
import type { JWTPayload } from '../../middleware/auth.middleware';
import * as callsService from './calls.service';
import { callFilterSchema } from './calls.schema';

const callsRouter = new Hono();

// Apply auth and CRM access middleware
callsRouter.use('*', authMiddleware, requireCRMAccess());

// POST /api/calls/upload - Upload audio recording
callsRouter.post('/upload', async (c) => {
  const user = c.get('user') as JWTPayload;
  const body = await c.req.parseBody();

  const file = body['file'];
  if (!file || !(file instanceof File)) {
    return c.json(
      { error: { message: 'Fichier audio requis', code: 'VALIDATION_ERROR' } },
      400
    );
  }

  const leadId = (body['leadId'] as string) || undefined;
  const buffer = Buffer.from(await file.arrayBuffer());

  const record = await callsService.uploadCall(
    buffer,
    file.name || 'audio.webm',
    file.type || 'audio/webm',
    leadId,
    user
  );

  return c.json(record, 201);
});

// GET /api/calls - List calls with optional filters
callsRouter.get(
  '/',
  zValidator('query', callFilterSchema),
  async (c) => {
    const user = c.get('user') as JWTPayload;
    const filters = c.req.valid('query');
    const calls = await callsService.getCalls(user, filters);
    return c.json(calls);
  }
);

// GET /api/calls/:id - Get call detail
callsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user') as JWTPayload;
  const call = await callsService.getCall(id, user);
  return c.json(call);
});

// GET /api/calls/lead/:leadId - Get calls for a specific lead
callsRouter.get('/lead/:leadId', async (c) => {
  const leadId = c.req.param('leadId');
  const user = c.get('user') as JWTPayload;
  const calls = await callsService.getCallsForLead(leadId, user);
  return c.json(calls);
});

// POST /api/calls/:id/analyze - Re-analyze an existing call
callsRouter.post('/:id/analyze', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user') as JWTPayload;
  const result = await callsService.reanalyzeCall(id, user);
  return c.json(result);
});

// POST /api/calls/:id/apply - Apply analysis results to the linked lead
callsRouter.post('/:id/apply', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user') as JWTPayload;
  const result = await callsService.applyAnalysisToLead(id, user);
  return c.json(result);
});

// DELETE /api/calls/:id - Delete a call recording
callsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user') as JWTPayload;
  await callsService.deleteCall(id, user);
  return c.json({ message: 'Enregistrement supprimé' });
});

export default callsRouter;

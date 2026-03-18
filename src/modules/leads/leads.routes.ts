import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  createLeadSchema,
  updateLeadSchema,
  changeStatusSchema,
  convertLeadSchema,
  leadFilterSchema,
} from './leads.schema';
import * as leadsService from './leads.service';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireCRMAccess } from '../../middleware/rbac.middleware';
import { paginationSchema } from '../../lib/pagination';
import type { JWTPayload } from '../../middleware/auth.middleware';

const leadsRouter = new Hono();

// Apply auth and CRM access middleware
leadsRouter.use('*', authMiddleware, requireCRMAccess());

// GET /api/leads - List leads with filters
leadsRouter.get(
  '/',
  zValidator('query', paginationSchema.merge(leadFilterSchema)),
  async (c) => {
    const query = c.req.valid('query');
    const { page, limit, ...filters } = query;
    const user = c.get('user') as JWTPayload;
    const result = await leadsService.getLeads({ page, limit }, filters, user);
    return c.json(result);
  }
);

// GET /api/leads/stats - Pipeline statistics
leadsRouter.get('/stats', async (c) => {
  const user = c.get('user') as JWTPayload;
  const stats = await leadsService.getLeadStats(user);
  return c.json(stats);
});

// GET /api/leads/:id - Get lead by ID
leadsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user') as JWTPayload;
  const lead = await leadsService.getLeadById(id, user);
  return c.json(lead);
});

// POST /api/leads - Create lead
leadsRouter.post('/', zValidator('json', createLeadSchema), async (c) => {
  const input = c.req.valid('json');
  const user = c.get('user') as JWTPayload;
  const lead = await leadsService.createLead(input, user);
  return c.json(lead, 201);
});

// PUT /api/leads/:id - Update lead
leadsRouter.put('/:id', zValidator('json', updateLeadSchema), async (c) => {
  const id = c.req.param('id');
  const input = c.req.valid('json');
  const user = c.get('user') as JWTPayload;
  const lead = await leadsService.updateLead(id, input, user);
  return c.json(lead);
});

// PUT /api/leads/:id/status - Change lead status
leadsRouter.put(
  '/:id/status',
  zValidator('json', changeStatusSchema),
  async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const user = c.get('user') as JWTPayload;
    const lead = await leadsService.changeLeadStatus(id, input, user);
    return c.json(lead);
  }
);

// POST /api/leads/:id/convert - Convert lead to project
leadsRouter.post(
  '/:id/convert',
  zValidator('json', convertLeadSchema),
  async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const user = c.get('user') as JWTPayload;
    const result = await leadsService.convertLead(id, input, user);
    return c.json(result, 201);
  }
);

// DELETE /api/leads/:id - Delete lead
leadsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user') as JWTPayload;
  await leadsService.deleteLead(id, user);
  return c.json({ message: 'Lead supprimé' });
});

export default leadsRouter;

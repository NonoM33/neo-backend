import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  createTicketSchema,
  updateTicketSchema,
  changeStatusSchema,
  assignTicketSchema,
  addCommentSchema,
  clientAddCommentSchema,
  satisfactionSchema,
  ticketFilterSchema,
  createSlaSchema,
  updateSlaSchema,
  createTicketCategorySchema,
  updateTicketCategorySchema,
  createCannedResponseSchema,
  updateCannedResponseSchema,
} from './tickets.schema';
import * as ticketsService from './tickets.service';
import { authMiddleware } from '../../middleware/auth.middleware';
import { clientAuthMiddleware } from '../middleware/client-auth.middleware';
import { requireIntegrateurOrAdmin, requireAdmin } from '../../middleware/rbac.middleware';
import { paginationSchema } from '../../lib/pagination';

// ============ Staff Routes ============

const staffTickets = new Hono();
staffTickets.use('*', authMiddleware, requireIntegrateurOrAdmin());

// List tickets with filters
staffTickets.get(
  '/',
  zValidator('query', paginationSchema.merge(ticketFilterSchema)),
  async (c) => {
    const { page, limit, ...filters } = c.req.valid('query');
    const result = await ticketsService.getTickets({ page, limit }, filters);
    return c.json(result);
  }
);

// Dashboard KPIs
staffTickets.get('/stats', async (c) => {
  const stats = await ticketsService.getTicketStats();
  return c.json(stats);
});

// Ticket categories
staffTickets.get('/categories', async (c) => {
  const categories = await ticketsService.getTicketCategories();
  return c.json(categories);
});

staffTickets.post(
  '/categories',
  zValidator('json', createTicketCategorySchema),
  async (c) => {
    const input = c.req.valid('json');
    const category = await ticketsService.createTicketCategory(input);
    return c.json(category, 201);
  }
);

staffTickets.put(
  '/categories/:id',
  zValidator('json', updateTicketCategorySchema),
  async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const category = await ticketsService.updateTicketCategory(id, input);
    return c.json(category);
  }
);

staffTickets.delete('/categories/:id', async (c) => {
  const id = c.req.param('id');
  await ticketsService.deleteTicketCategory(id);
  return c.json({ message: 'Catégorie supprimée' });
});

// SLA definitions
staffTickets.get('/sla', async (c) => {
  const slas = await ticketsService.getSlaDefinitions();
  return c.json(slas);
});

staffTickets.post(
  '/sla',
  zValidator('json', createSlaSchema),
  async (c) => {
    const input = c.req.valid('json');
    const sla = await ticketsService.createSla(input);
    return c.json(sla, 201);
  }
);

staffTickets.put(
  '/sla/:id',
  zValidator('json', updateSlaSchema),
  async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const sla = await ticketsService.updateSla(id, input);
    return c.json(sla);
  }
);

staffTickets.delete('/sla/:id', async (c) => {
  const id = c.req.param('id');
  await ticketsService.deleteSla(id);
  return c.json({ message: 'Définition SLA supprimée' });
});

// Canned responses
staffTickets.get('/canned-responses', async (c) => {
  const responses = await ticketsService.getCannedResponses();
  return c.json(responses);
});

staffTickets.post(
  '/canned-responses',
  zValidator('json', createCannedResponseSchema),
  async (c) => {
    const input = c.req.valid('json');
    const response = await ticketsService.createCannedResponse(input);
    return c.json(response, 201);
  }
);

staffTickets.put(
  '/canned-responses/:id',
  zValidator('json', updateCannedResponseSchema),
  async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const response = await ticketsService.updateCannedResponse(id, input);
    return c.json(response);
  }
);

staffTickets.delete('/canned-responses/:id', async (c) => {
  const id = c.req.param('id');
  await ticketsService.deleteCannedResponse(id);
  return c.json({ message: 'Réponse pré-enregistrée supprimée' });
});

// Ticket detail
staffTickets.get('/:id', async (c) => {
  const id = c.req.param('id');
  const ticket = await ticketsService.getTicketById(id);
  return c.json(ticket);
});

// Create ticket
staffTickets.post(
  '/',
  zValidator('json', createTicketSchema),
  async (c) => {
    const input = c.req.valid('json');
    const user = c.get('user');
    const ticket = await ticketsService.createTicket(input, user.userId);
    return c.json(ticket, 201);
  }
);

// Update ticket
staffTickets.put(
  '/:id',
  zValidator('json', updateTicketSchema),
  async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const user = c.get('user');
    const ticket = await ticketsService.updateTicket(id, input, user.userId);
    return c.json(ticket);
  }
);

// Change status
staffTickets.put(
  '/:id/status',
  zValidator('json', changeStatusSchema),
  async (c) => {
    const id = c.req.param('id');
    const { status, notes } = c.req.valid('json');
    const user = c.get('user');
    const ticket = await ticketsService.changeStatus(id, status, user.userId, notes);
    return c.json(ticket);
  }
);

// Assign ticket
staffTickets.put(
  '/:id/assign',
  zValidator('json', assignTicketSchema),
  async (c) => {
    const id = c.req.param('id');
    const { assignedToId } = c.req.valid('json');
    const user = c.get('user');
    const ticket = await ticketsService.assignTicket(id, assignedToId, user.userId);
    return c.json(ticket);
  }
);

// Escalate ticket
staffTickets.put('/:id/escalate', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const ticket = await ticketsService.escalateTicket(id, user.userId);
  return c.json(ticket);
});

// Add comment
staffTickets.post(
  '/:id/comments',
  zValidator('json', addCommentSchema),
  async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const user = c.get('user');
    const comment = await ticketsService.addComment(id, input, user.userId, 'staff');
    return c.json(comment, 201);
  }
);

// Audit trail
staffTickets.get('/:id/history', async (c) => {
  const id = c.req.param('id');
  const history = await ticketsService.getTicketHistory(id);
  return c.json(history);
});

// ============ Client Routes ============

const clientTickets = new Hono();
clientTickets.use('*', clientAuthMiddleware);

// List my tickets
clientTickets.get(
  '/',
  zValidator('query', paginationSchema.merge(z.object({ status: z.string().optional() }))),
  async (c) => {
    const { page, limit, status } = c.req.valid('query');
    const clientId = c.get('clientId');
    const result = await ticketsService.getClientTickets(clientId, { page, limit }, status);
    return c.json(result);
  }
);

// Get ticket detail (public comments only)
clientTickets.get('/:id', async (c) => {
  const id = c.req.param('id');
  const clientId = c.get('clientId');
  const ticket = await ticketsService.getClientTicketById(id, clientId);
  return c.json(ticket);
});

// Add comment (always public, authorType='client')
clientTickets.post(
  '/:id/comments',
  zValidator('json', clientAddCommentSchema),
  async (c) => {
    const id = c.req.param('id');
    const { content } = c.req.valid('json');
    const clientId = c.get('clientId');
    const clientAccountId = c.get('clientAccountId');
    const comment = await ticketsService.addComment(
      id,
      { content, type: 'public' },
      clientAccountId,
      'client'
    );
    return c.json(comment, 201);
  }
);

// Rate resolution
clientTickets.post(
  '/:id/satisfaction',
  zValidator('json', satisfactionSchema),
  async (c) => {
    const id = c.req.param('id');
    const { rating, comment } = c.req.valid('json');
    const clientId = c.get('clientId');
    const ticket = await ticketsService.addClientSatisfaction(id, clientId, rating, comment);
    return c.json(ticket);
  }
);

export const staffRoutes = staffTickets;
export const clientRoutes = clientTickets;

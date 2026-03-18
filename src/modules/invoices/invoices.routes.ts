import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  createInvoiceSchema,
  createInvoiceFromOrderSchema,
  updateInvoiceSchema,
  changeInvoiceStatusSchema,
  invoiceFilterSchema,
} from './invoices.schema';
import * as invoicesService from './invoices.service';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/rbac.middleware';
import { paginationSchema } from '../../lib/pagination';

const invoicesRouter = new Hono();

// Lister les factures
invoicesRouter.get(
  '/',
  authMiddleware,
  requireAdmin(),
  zValidator('query', paginationSchema.merge(invoiceFilterSchema)),
  async (c) => {
    const { page, limit, ...filters } = c.req.valid('query');
    const result = await invoicesService.getInvoices({ page, limit }, filters);
    return c.json(result);
  }
);

// Statistiques
invoicesRouter.get(
  '/stats',
  authMiddleware,
  requireAdmin(),
  async (c) => {
    const stats = await invoicesService.getInvoiceStats();
    return c.json(stats);
  }
);

// Détail d'une facture
invoicesRouter.get(
  '/:id',
  authMiddleware,
  requireAdmin(),
  async (c) => {
    const id = c.req.param('id')!;
    const invoice = await invoicesService.getInvoiceById(id);
    return c.json(invoice);
  }
);

// Créer une facture
invoicesRouter.post(
  '/',
  authMiddleware,
  requireAdmin(),
  zValidator('json', createInvoiceSchema),
  async (c) => {
    const input = c.req.valid('json');
    const userId = c.get('userId');
    const invoice = await invoicesService.createInvoice(input, userId);
    return c.json(invoice, 201);
  }
);

// Créer une facture depuis une commande
invoicesRouter.post(
  '/depuis-commande',
  authMiddleware,
  requireAdmin(),
  zValidator('json', createInvoiceFromOrderSchema),
  async (c) => {
    const input = c.req.valid('json');
    const userId = c.get('userId');
    const invoice = await invoicesService.createInvoiceFromOrder(input, userId);
    return c.json(invoice, 201);
  }
);

// Modifier une facture
invoicesRouter.put(
  '/:id',
  authMiddleware,
  requireAdmin(),
  zValidator('json', updateInvoiceSchema),
  async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const invoice = await invoicesService.updateInvoice(id, input);
    return c.json(invoice);
  }
);

// Changer le statut
invoicesRouter.put(
  '/:id/status',
  authMiddleware,
  requireAdmin(),
  zValidator('json', changeInvoiceStatusSchema),
  async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const userId = c.get('userId');
    const invoice = await invoicesService.changeInvoiceStatus(id, input, userId);
    return c.json(invoice);
  }
);

// Supprimer une facture
invoicesRouter.delete(
  '/:id',
  authMiddleware,
  requireAdmin(),
  async (c) => {
    const id = c.req.param('id')!;
    await invoicesService.deleteInvoice(id);
    return c.json({ message: 'Facture supprimée' });
  }
);

// TODO: Endpoint pour générer le PDF
// invoicesRouter.get('/:id/pdf', ...)

export default invoicesRouter;

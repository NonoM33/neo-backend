import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  createOrderSchema,
  updateOrderSchema,
  changeOrderStatusSchema,
  orderFilterSchema,
} from './orders.schema';
import * as ordersService from './orders.service';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireAdmin, requireIntegrateurOrAdmin } from '../../middleware/rbac.middleware';
import { paginationSchema } from '../../lib/pagination';

const ordersRouter = new Hono();

// Lister les commandes
ordersRouter.get(
  '/',
  authMiddleware,
  requireIntegrateurOrAdmin(),
  zValidator('query', paginationSchema.merge(orderFilterSchema)),
  async (c) => {
    const { page, limit, ...filters } = c.req.valid('query');
    const result = await ordersService.getOrders({ page, limit }, filters);
    return c.json(result);
  }
);

// Statistiques
ordersRouter.get(
  '/stats',
  authMiddleware,
  requireAdmin(),
  async (c) => {
    const stats = await ordersService.getOrderStats();
    return c.json(stats);
  }
);

// Détail d'une commande
ordersRouter.get(
  '/:id',
  authMiddleware,
  requireIntegrateurOrAdmin(),
  async (c) => {
    const id = c.req.param('id')!;
    const order = await ordersService.getOrderById(id);
    return c.json(order);
  }
);

// Créer une commande
ordersRouter.post(
  '/',
  authMiddleware,
  requireAdmin(),
  zValidator('json', createOrderSchema),
  async (c) => {
    const input = c.req.valid('json');
    const userId = c.get('userId');
    const order = await ordersService.createOrder(input, userId);
    return c.json(order, 201);
  }
);

// Modifier une commande
ordersRouter.put(
  '/:id',
  authMiddleware,
  requireAdmin(),
  zValidator('json', updateOrderSchema),
  async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const order = await ordersService.updateOrder(id, input);
    return c.json(order);
  }
);

// Changer le statut
ordersRouter.put(
  '/:id/status',
  authMiddleware,
  requireAdmin(),
  zValidator('json', changeOrderStatusSchema),
  async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const userId = c.get('userId');
    const order = await ordersService.changeOrderStatus(id, input, userId);
    return c.json(order);
  }
);

// Supprimer une commande
ordersRouter.delete(
  '/:id',
  authMiddleware,
  requireAdmin(),
  async (c) => {
    const id = c.req.param('id')!;
    await ordersService.deleteOrder(id);
    return c.json({ message: 'Commande supprimée' });
  }
);

// Convertir un devis en commande
ordersRouter.post(
  '/depuis-devis/:quoteId',
  authMiddleware,
  requireAdmin(),
  async (c) => {
    const quoteId = c.req.param('quoteId')!;
    const userId = c.get('userId');
    const order = await ordersService.convertQuoteToOrder(quoteId, userId);
    return c.json(order, 201);
  }
);

export default ordersRouter;

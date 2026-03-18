import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  createSupplierOrderSchema,
  updateSupplierOrderSchema,
  changeSupplierOrderStatusSchema,
  receptionInputSchema,
  supplierOrderFilterSchema,
} from './supplier-orders.schema';
import * as supplierOrdersService from './supplier-orders.service';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/rbac.middleware';
import { paginationSchema } from '../../lib/pagination';

const supplierOrdersRouter = new Hono();

// Lister les commandes fournisseurs
supplierOrdersRouter.get(
  '/',
  authMiddleware,
  requireAdmin(),
  zValidator('query', paginationSchema.merge(supplierOrderFilterSchema)),
  async (c) => {
    const { page, limit, ...filters } = c.req.valid('query');
    const result = await supplierOrdersService.getSupplierOrders({ page, limit }, filters);
    return c.json(result);
  }
);

// Statistiques
supplierOrdersRouter.get(
  '/stats',
  authMiddleware,
  requireAdmin(),
  async (c) => {
    const stats = await supplierOrdersService.getSupplierOrderStats();
    return c.json(stats);
  }
);

// Détail d'une commande fournisseur
supplierOrdersRouter.get(
  '/:id',
  authMiddleware,
  requireAdmin(),
  async (c) => {
    const id = c.req.param('id')!;
    const order = await supplierOrdersService.getSupplierOrderById(id);
    return c.json(order);
  }
);

// Créer une commande fournisseur
supplierOrdersRouter.post(
  '/',
  authMiddleware,
  requireAdmin(),
  zValidator('json', createSupplierOrderSchema),
  async (c) => {
    const input = c.req.valid('json');
    const userId = c.get('userId');
    const order = await supplierOrdersService.createSupplierOrder(input, userId);
    return c.json(order, 201);
  }
);

// Créer depuis suggestions de réapprovisionnement
supplierOrdersRouter.post(
  '/depuis-suggestions',
  authMiddleware,
  requireAdmin(),
  zValidator(
    'json',
    z.object({
      supplierId: z.string().uuid(),
      productIds: z.array(z.string().uuid()).min(1),
    })
  ),
  async (c) => {
    const { supplierId, productIds } = c.req.valid('json');
    const userId = c.get('userId');
    const order = await supplierOrdersService.createFromSuggestions(
      supplierId,
      productIds,
      userId
    );
    return c.json(order, 201);
  }
);

// Modifier une commande fournisseur
supplierOrdersRouter.put(
  '/:id',
  authMiddleware,
  requireAdmin(),
  zValidator('json', updateSupplierOrderSchema),
  async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const order = await supplierOrdersService.updateSupplierOrder(id, input);
    return c.json(order);
  }
);

// Changer le statut
supplierOrdersRouter.put(
  '/:id/status',
  authMiddleware,
  requireAdmin(),
  zValidator('json', changeSupplierOrderStatusSchema),
  async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const userId = c.get('userId');
    const order = await supplierOrdersService.changeSupplierOrderStatus(id, input, userId);
    return c.json(order);
  }
);

// Enregistrer une réception
supplierOrdersRouter.post(
  '/:id/reception',
  authMiddleware,
  requireAdmin(),
  zValidator('json', receptionInputSchema),
  async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const userId = c.get('userId');
    const order = await supplierOrdersService.receiveSupplierOrder(id, input, userId);
    return c.json(order);
  }
);

// Supprimer une commande fournisseur
supplierOrdersRouter.delete(
  '/:id',
  authMiddleware,
  requireAdmin(),
  async (c) => {
    const id = c.req.param('id')!;
    await supplierOrdersService.deleteSupplierOrder(id);
    return c.json({ message: 'Commande fournisseur supprimée' });
  }
);

export default supplierOrdersRouter;

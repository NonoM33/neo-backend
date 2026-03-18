import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createStockMovementSchema, stockFilterSchema, stockAlertFilterSchema } from './stock.schema';
import * as stockService from './stock.service';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireAdmin, requireIntegrateurOrAdmin } from '../../middleware/rbac.middleware';
import { paginationSchema } from '../../lib/pagination';

const stockRouter = new Hono();

// Dashboard stock
stockRouter.get(
  '/',
  authMiddleware,
  requireIntegrateurOrAdmin(),
  async (c) => {
    const dashboard = await stockService.getStockDashboard();
    return c.json(dashboard);
  }
);

// Alertes de stock bas
stockRouter.get(
  '/alertes',
  authMiddleware,
  requireIntegrateurOrAdmin(),
  zValidator('query', stockAlertFilterSchema),
  async (c) => {
    const filters = c.req.valid('query');
    const alerts = await stockService.getStockAlerts(filters);
    return c.json(alerts);
  }
);

// Suggestions de réapprovisionnement
stockRouter.get(
  '/suggestions',
  authMiddleware,
  requireAdmin(),
  async (c) => {
    const suggestions = await stockService.getReplenishmentSuggestions();
    return c.json(suggestions);
  }
);

// Historique des mouvements
stockRouter.get(
  '/mouvements',
  authMiddleware,
  requireIntegrateurOrAdmin(),
  zValidator('query', paginationSchema.merge(stockFilterSchema)),
  async (c) => {
    const { page, limit, ...filters } = c.req.valid('query');
    const movements = await stockService.getStockMovements({ page, limit }, filters);
    return c.json(movements);
  }
);

// Stock d'un produit spécifique
stockRouter.get(
  '/produit/:productId',
  authMiddleware,
  requireIntegrateurOrAdmin(),
  async (c) => {
    const productId = c.req.param('productId')!;
    const stock = await stockService.getProductStock(productId);
    return c.json(stock);
  }
);

// Créer un mouvement de stock manuel (admin uniquement)
stockRouter.post(
  '/mouvement',
  authMiddleware,
  requireAdmin(),
  zValidator('json', createStockMovementSchema),
  async (c) => {
    const input = c.req.valid('json');
    const userId = c.get('userId');
    const movement = await stockService.createStockMovement(input, userId);
    return c.json(movement, 201);
  }
);

export default stockRouter;

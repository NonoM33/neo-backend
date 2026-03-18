import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createProductSchema, updateProductSchema, productFilterSchema, createDependencySchema, updateDependencySchema } from './products.schema';
import * as productsService from './products.service';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireAdmin, requireAuditeur } from '../../middleware/rbac.middleware';
import { paginationSchema } from '../../lib/pagination';
import { ValidationError } from '../../lib/errors';

const productsRouter = new Hono();

// Strip cost fields from product responses (mobile API should never see these)
function stripCostFields(product: Record<string, any>) {
  const { purchasePriceHT, supplierId, supplierProductUrl, ...safe } = product;
  return safe;
}

function stripCostFieldsFromList(products: Record<string, any>[]) {
  return products.map(stripCostFields);
}

// Public read endpoints (requires authentication but any role)
productsRouter.get(
  '/',
  authMiddleware,
  requireAuditeur(),
  zValidator('query', paginationSchema.merge(productFilterSchema)),
  async (c) => {
    const { page, limit, ...filters } = c.req.valid('query');
    const result = await productsService.getProducts({ page, limit }, filters);
    return c.json({ ...result, data: stripCostFieldsFromList(result.data) });
  }
);

productsRouter.get('/categories', authMiddleware, requireAuditeur(), async (c) => {
  const categories = await productsService.getCategories();
  return c.json(categories);
});

productsRouter.get('/marques', authMiddleware, requireAuditeur(), async (c) => {
  const brands = await productsService.getBrands();
  return c.json(brands);
});

productsRouter.get('/:id', authMiddleware, requireAuditeur(), async (c) => {
  const id = c.req.param('id')!;
  const product = await productsService.getProductWithDependencies(id);
  return c.json(stripCostFields(product));
});

// Admin-only write endpoints
productsRouter.post(
  '/',
  authMiddleware,
  requireAdmin(),
  zValidator('json', createProductSchema),
  async (c) => {
    const input = c.req.valid('json');
    const product = await productsService.createProduct(input);
    return c.json(product, 201);
  }
);

productsRouter.put(
  '/:id',
  authMiddleware,
  requireAdmin(),
  zValidator('json', updateProductSchema),
  async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const product = await productsService.updateProduct(id, input);
    return c.json(product);
  }
);

productsRouter.delete('/:id', authMiddleware, requireAdmin(), async (c) => {
  const id = c.req.param('id')!;
  await productsService.deleteProduct(id);
  return c.json({ message: 'Produit supprimé' });
});

// ========================================
// DÉPENDANCES PRODUITS
// ========================================

// Lister les dépendances d'un produit
productsRouter.get('/:id/dependances', authMiddleware, requireAuditeur(), async (c) => {
  const id = c.req.param('id')!;
  const deps = await productsService.getProductDependencies(id);
  return c.json(deps);
});

// Ajouter une dépendance (admin)
productsRouter.post(
  '/:id/dependances',
  authMiddleware,
  requireAdmin(),
  zValidator('json', createDependencySchema),
  async (c) => {
    const id = c.req.param('id')!;
    const input = c.req.valid('json');
    const dep = await productsService.addProductDependency(id, input);
    return c.json(dep, 201);
  }
);

// Modifier une dépendance (admin)
productsRouter.put(
  '/dependances/:depId',
  authMiddleware,
  requireAdmin(),
  zValidator('json', updateDependencySchema),
  async (c) => {
    const depId = c.req.param('depId')!;
    const input = c.req.valid('json');
    const dep = await productsService.updateProductDependency(depId, input);
    return c.json(dep);
  }
);

// Supprimer une dépendance (admin)
productsRouter.delete('/dependances/:depId', authMiddleware, requireAdmin(), async (c) => {
  const depId = c.req.param('depId')!;
  await productsService.removeProductDependency(depId);
  return c.json({ message: 'Dépendance supprimée' });
});

// CSV Import
productsRouter.post('/import', authMiddleware, requireAdmin(), async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    throw new ValidationError('Fichier CSV requis');
  }

  const content = await file.text();
  const result = await productsService.importProductsFromCSV(content);

  return c.json({
    message: `Import terminé: ${result.imported} produits importés`,
    imported: result.imported,
    errors: result.errors,
  });
});

export default productsRouter;

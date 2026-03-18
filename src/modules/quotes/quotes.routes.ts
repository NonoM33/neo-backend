import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createQuoteSchema, updateQuoteSchema } from './quotes.schema';
import * as quotesService from './quotes.service';
import * as productsService from '../products/products.service';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireIntegrateurOrAdmin } from '../../middleware/rbac.middleware';

const quotesRouter = new Hono();

// Strip cost/margin fields from quote responses (mobile API should never see these)
function stripQuoteCostFields(quote: Record<string, any>) {
  const { totalCostHT, totalMarginHT, marginPercent, ...safeQuote } = quote;
  if (safeQuote.lines) {
    safeQuote.lines = safeQuote.lines.map((line: Record<string, any>) => {
      const { unitCostHT, ...safeLine } = line;
      return safeLine;
    });
  }
  return safeQuote;
}

quotesRouter.use('*', authMiddleware, requireIntegrateurOrAdmin());

// Get quotes by project
quotesRouter.get('/projets/:projectId/devis', async (c) => {
  const projectId = c.req.param('projectId');
  const user = c.get('user');
  const quotesList = await quotesService.getQuotesByProject(projectId, user.userId, user.role);
  return c.json(quotesList.map(q => stripQuoteCostFields(q)));
});

// Create quote for project
quotesRouter.post(
  '/projets/:projectId/devis',
  zValidator('json', createQuoteSchema),
  async (c) => {
    const projectId = c.req.param('projectId');
    const input = c.req.valid('json');
    const user = c.get('user');
    const quote = await quotesService.createQuote(projectId, input, user.userId, user.role);
    return c.json(stripQuoteCostFields(quote), 201);
  }
);

// Get quote by ID
quotesRouter.get('/devis/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const quote = await quotesService.getQuoteById(id, user.userId, user.role);
  return c.json(stripQuoteCostFields(quote));
});

// Update quote
quotesRouter.put('/devis/:id', zValidator('json', updateQuoteSchema), async (c) => {
  const id = c.req.param('id');
  const input = c.req.valid('json');
  const user = c.get('user');
  const quote = await quotesService.updateQuote(id, input, user.userId, user.role);
  return c.json(stripQuoteCostFields(quote));
});

// Delete quote
quotesRouter.delete('/devis/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  await quotesService.deleteQuote(id, user.userId, user.role);
  return c.json({ message: 'Devis supprimé' });
});

// Vérifier les dépendances manquantes dans un devis
quotesRouter.get('/devis/:id/dependances-manquantes', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const quote = await quotesService.getQuoteById(id, user.userId, user.role);

  // Extraire les productIds des lignes (exclure les lignes clientOwned)
  const productIds = quote.lines
    .filter((line: any) => line.product?.id && !line.clientOwned)
    .map((line: any) => line.product.id);

  // Ajouter aussi les produits marqués clientOwned (ils sont "satisfaits")
  const clientOwnedProductIds = quote.lines
    .filter((line: any) => line.product?.id && line.clientOwned)
    .map((line: any) => line.product.id);

  const allCoveredProductIds = [...productIds, ...clientOwnedProductIds];

  const missing = await productsService.checkMissingDependencies(
    quote.lines.filter((line: any) => line.product?.id).map((line: any) => line.product.id)
  );

  // Filtrer ceux qui sont déjà couverts par clientOwned
  const actuallyMissing = missing.filter(
    (m) => !allCoveredProductIds.includes(m.requiredProductId)
  );

  return c.json({
    quoteId: id,
    missing: actuallyMissing,
    hasMissingDependencies: actuallyMissing.length > 0,
  });
});

// Generate PDF
quotesRouter.get('/devis/:id/pdf', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const quote = await quotesService.getQuoteWithProjectDetails(id, user.userId, user.role);

  const validUntilStr = quote.validUntil
    ? `<p>Valide jusqu'au: ${new Date(quote.validUntil).toLocaleDateString('fr-FR')}</p>`
    : '';

  const clientAddress = quote.client?.address ? `<p>${quote.client.address}</p>` : '';
  const clientLocation = (quote.client?.postalCode || quote.client?.city)
    ? `<p>${quote.client.postalCode || ''} ${quote.client.city || ''}</p>`
    : '';

  const projectAddress = quote.project?.address ? `<p>${quote.project.address}</p>` : '';

  const linesHtml = quote.lines.map(line => `
    <tr>
      <td>${line.description}</td>
      <td>${line.quantity}</td>
      <td>${parseFloat(line.unitPriceHT ?? '0').toFixed(2)} EUR</td>
      <td>${parseFloat(line.tvaRate ?? '0').toFixed(0)}%</td>
      <td>${parseFloat(line.totalHT ?? '0').toFixed(2)} EUR</td>
    </tr>
  `).join('');

  const notesHtml = quote.notes ? `<div class="notes"><h3>Notes</h3><p>${quote.notes}</p></div>` : '';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Devis ${quote.number}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        h1 { color: #333; }
        .header { margin-bottom: 30px; }
        .client-info { margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        th { background-color: #f5f5f5; }
        .totals { text-align: right; margin-top: 20px; }
        .total-line { margin: 5px 0; }
        .total-ttc { font-size: 1.2em; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>DEVIS ${quote.number}</h1>
        <p>Date: ${quote.createdAt ? new Date(quote.createdAt).toLocaleDateString('fr-FR') : ''}</p>
        ${validUntilStr}
      </div>

      <div class="client-info">
        <h3>Client</h3>
        <p>${quote.client?.firstName ?? ''} ${quote.client?.lastName ?? ''}</p>
        ${clientAddress}
        ${clientLocation}
      </div>

      <div class="project-info">
        <h3>Projet: ${quote.project?.name ?? ''}</h3>
        ${projectAddress}
      </div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Qte</th>
            <th>Prix HT</th>
            <th>TVA</th>
            <th>Total HT</th>
          </tr>
        </thead>
        <tbody>
          ${linesHtml}
        </tbody>
      </table>

      <div class="totals">
        <p class="total-line">Total HT: ${parseFloat(quote.totalHT ?? '0').toFixed(2)} EUR</p>
        <p class="total-line">TVA: ${parseFloat(quote.totalTVA ?? '0').toFixed(2)} EUR</p>
        <p class="total-line total-ttc">Total TTC: ${parseFloat(quote.totalTTC ?? '0').toFixed(2)} EUR</p>
      </div>

      ${notesHtml}
    </body>
    </html>
  `;

  return c.html(html);
});

// Send quote by email
quotesRouter.post('/devis/:id/envoyer', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const result = await quotesService.sendQuote(id, user.userId, user.role);
  return c.json(result);
});

export default quotesRouter;

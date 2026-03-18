import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  createKbCategorySchema,
  updateKbCategorySchema,
  createArticleSchema,
  updateArticleSchema,
  createFaqSchema,
  updateFaqSchema,
  articleSearchSchema,
  articleFeedbackSchema,
} from './kb.schema';
import * as kbService from './kb.service';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireIntegrateurOrAdmin } from '../../middleware/rbac.middleware';
import { clientAuthMiddleware } from '../middleware/client-auth.middleware';
import { paginationSchema } from '../../lib/pagination';

// ============ Staff Routes ============

const staffKb = new Hono();

staffKb.use('*', authMiddleware, requireIntegrateurOrAdmin());

// Categories CRUD

staffKb.get('/categories', async (c) => {
  const categories = await kbService.getCategories();
  return c.json(categories);
});

staffKb.post('/categories', zValidator('json', createKbCategorySchema), async (c) => {
  const input = c.req.valid('json');
  const category = await kbService.createCategory(input);
  return c.json(category, 201);
});

staffKb.put('/categories/:id', zValidator('json', updateKbCategorySchema), async (c) => {
  const id = c.req.param('id');
  const input = c.req.valid('json');
  const category = await kbService.updateCategory(id, input);
  return c.json(category);
});

staffKb.delete('/categories/:id', async (c) => {
  const id = c.req.param('id');
  await kbService.deleteCategory(id);
  return c.json({ message: 'Catégorie supprimée' });
});

// Articles CRUD

staffKb.get(
  '/articles',
  zValidator(
    'query',
    paginationSchema.merge(
      z.object({
        status: z.string().optional(),
        categoryId: z.string().optional(),
        search: z.string().optional(),
      })
    )
  ),
  async (c) => {
    const { page, limit, ...filters } = c.req.valid('query');
    const result = await kbService.getArticles({ page, limit }, filters);
    return c.json(result);
  }
);

staffKb.get('/articles/:id', async (c) => {
  const id = c.req.param('id');
  const article = await kbService.getArticleById(id);
  return c.json(article);
});

staffKb.post('/articles', zValidator('json', createArticleSchema), async (c) => {
  const input = c.req.valid('json');
  const user = c.get('user');
  const article = await kbService.createArticle(input, user.userId);
  return c.json(article, 201);
});

staffKb.put('/articles/:id', zValidator('json', updateArticleSchema), async (c) => {
  const id = c.req.param('id');
  const input = c.req.valid('json');
  const user = c.get('user');
  const article = await kbService.updateArticle(id, input, user.userId);
  return c.json(article);
});

staffKb.delete('/articles/:id', async (c) => {
  const id = c.req.param('id');
  await kbService.deleteArticle(id);
  return c.json({ message: 'Article supprimé' });
});

// FAQ CRUD

staffKb.get('/faq', async (c) => {
  const items = await kbService.getFaqItems();
  return c.json(items);
});

staffKb.post('/faq', zValidator('json', createFaqSchema), async (c) => {
  const input = c.req.valid('json');
  const faq = await kbService.createFaq(input);
  return c.json(faq, 201);
});

staffKb.put('/faq/:id', zValidator('json', updateFaqSchema), async (c) => {
  const id = c.req.param('id');
  const input = c.req.valid('json');
  const faq = await kbService.updateFaq(id, input);
  return c.json(faq);
});

staffKb.delete('/faq/:id', async (c) => {
  const id = c.req.param('id');
  await kbService.deleteFaq(id);
  return c.json({ message: 'FAQ supprimée' });
});

// ============ Client/Public Routes ============

const clientKb = new Hono();

clientKb.use('*', clientAuthMiddleware);

clientKb.get(
  '/search',
  zValidator('query', paginationSchema.merge(articleSearchSchema)),
  async (c) => {
    const { page, limit, q, category, tag } = c.req.valid('query');
    const result = await kbService.searchPublishedArticles({ page, limit }, q, category, tag);
    return c.json(result);
  }
);

clientKb.get('/articles/:slug', async (c) => {
  const slug = c.req.param('slug');
  const article = await kbService.getPublishedArticleBySlug(slug);
  return c.json(article);
});

clientKb.post(
  '/articles/:id/feedback',
  zValidator('json', articleFeedbackSchema),
  async (c) => {
    const id = c.req.param('id');
    const { helpful } = c.req.valid('json');
    await kbService.recordArticleFeedback(id, helpful);
    return c.json({ message: 'Feedback enregistré' });
  }
);

clientKb.get('/faq', async (c) => {
  const items = await kbService.getFaqItems(true);
  return c.json(items);
});

export const staffRoutes = staffKb;
export const clientRoutes = clientKb;

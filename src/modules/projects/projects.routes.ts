import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  createClientSchema,
  updateClientSchema,
  createProjectSchema,
  updateProjectSchema,
  projectFilterSchema,
} from './projects.schema';
import * as projectsService from './projects.service';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireIntegrateurOrAdmin } from '../../middleware/rbac.middleware';
import { paginationSchema } from '../../lib/pagination';

const projectsRouter = new Hono();

// All routes require authentication
projectsRouter.use('*', authMiddleware, requireIntegrateurOrAdmin());

// ============ Clients Routes ============

projectsRouter.get(
  '/clients',
  zValidator('query', paginationSchema.merge(z.object({ search: z.string().optional() }))),
  async (c) => {
    const { page, limit, search } = c.req.valid('query');
    const result = await projectsService.getClients({ page, limit }, search);
    return c.json(result);
  }
);

projectsRouter.get('/clients/:id', async (c) => {
  const id = c.req.param('id');
  const client = await projectsService.getClientById(id);
  return c.json(client);
});

projectsRouter.post('/clients', zValidator('json', createClientSchema), async (c) => {
  const input = c.req.valid('json');
  const client = await projectsService.createClient(input);
  return c.json(client, 201);
});

projectsRouter.put('/clients/:id', zValidator('json', updateClientSchema), async (c) => {
  const id = c.req.param('id');
  const input = c.req.valid('json');
  const client = await projectsService.updateClient(id, input);
  return c.json(client);
});

projectsRouter.delete('/clients/:id', async (c) => {
  const id = c.req.param('id');
  await projectsService.deleteClient(id);
  return c.json({ message: 'Client supprimé' });
});

// ============ Projects Routes ============

projectsRouter.get(
  '/',
  zValidator('query', paginationSchema.merge(projectFilterSchema)),
  async (c) => {
    const { page, limit, ...filters } = c.req.valid('query');
    const user = c.get('user');
    const result = await projectsService.getProjects(
      { page, limit },
      filters,
      user.userId,
      user.role
    );
    return c.json(result);
  }
);

projectsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const project = await projectsService.getProjectById(id, user.userId, user.role);
  return c.json(project);
});

projectsRouter.post('/', zValidator('json', createProjectSchema), async (c) => {
  const input = c.req.valid('json');
  const user = c.get('user');
  const project = await projectsService.createProject(input, user.userId);
  return c.json(project, 201);
});

projectsRouter.put('/:id', zValidator('json', updateProjectSchema), async (c) => {
  const id = c.req.param('id');
  const input = c.req.valid('json');
  const user = c.get('user');
  const project = await projectsService.updateProject(id, input, user.userId, user.role);
  return c.json(project);
});

projectsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  await projectsService.deleteProject(id, user.userId, user.role);
  return c.json({ message: 'Projet supprimé' });
});

export default projectsRouter;

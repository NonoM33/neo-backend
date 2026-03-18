import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createUserSchema, updateUserSchema, userFilterSchema } from './users.schema';
import * as usersService from './users.service';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/rbac.middleware';
import { paginationSchema } from '../../lib/pagination';

const usersRouter = new Hono();

// All routes require admin
usersRouter.use('*', authMiddleware, requireAdmin());

usersRouter.get('/', zValidator('query', paginationSchema.merge(userFilterSchema)), async (c) => {
  const query = c.req.valid('query');
  const { page, limit, ...filters } = query;
  const result = await usersService.getUsers({ page, limit }, filters);
  return c.json(result);
});

usersRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const user = await usersService.getUserById(id);
  return c.json(user);
});

usersRouter.post('/', zValidator('json', createUserSchema), async (c) => {
  const input = c.req.valid('json');
  const user = await usersService.createUser(input);
  return c.json(user, 201);
});

usersRouter.put('/:id', zValidator('json', updateUserSchema), async (c) => {
  const id = c.req.param('id');
  const input = c.req.valid('json');
  const user = await usersService.updateUser(id, input);
  return c.json(user);
});

usersRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  await usersService.deleteUser(id);
  return c.json({ message: 'Utilisateur supprimé' });
});

export default usersRouter;

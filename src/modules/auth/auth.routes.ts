import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { loginSchema, refreshSchema } from './auth.schema';
import * as authService from './auth.service';
import { authMiddleware } from '../../middleware/auth.middleware';

const auth = new Hono();

auth.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');
  const result = await authService.login(email, password);
  return c.json(result);
});

auth.post('/logout', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const refreshToken = body.refreshToken;

  if (refreshToken) {
    await authService.logout(refreshToken);
  }

  return c.json({ message: 'Déconnexion réussie' });
});

auth.post('/refresh', zValidator('json', refreshSchema), async (c) => {
  const { refreshToken } = c.req.valid('json');
  const result = await authService.refresh(refreshToken);
  return c.json(result);
});

auth.get('/me', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const user = await authService.getMe(userId);
  return c.json(user);
});

export default auth;

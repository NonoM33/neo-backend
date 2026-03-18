import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { clientLoginSchema, clientRefreshSchema, createClientAccountSchema } from './auth.schema';
import * as clientAuthService from './auth.service';
import { clientAuthMiddleware } from '../middleware/client-auth.middleware';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/rbac.middleware';

const clientAuth = new Hono();

// Public routes
clientAuth.post('/login', zValidator('json', clientLoginSchema), async (c) => {
  const { email, password } = c.req.valid('json');
  const result = await clientAuthService.login(email, password);
  return c.json(result);
});

clientAuth.post('/refresh', zValidator('json', clientRefreshSchema), async (c) => {
  const { refreshToken } = c.req.valid('json');
  const result = await clientAuthService.refresh(refreshToken);
  return c.json(result);
});

clientAuth.post('/logout', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const refreshToken = body.refreshToken;
  if (refreshToken) {
    await clientAuthService.logout(refreshToken);
  }
  return c.json({ message: 'Déconnexion réussie' });
});

// Protected client routes
clientAuth.get('/me', clientAuthMiddleware, async (c) => {
  const clientAccountId = c.get('clientAccountId');
  const account = await clientAuthService.getMe(clientAccountId);
  return c.json(account);
});

// Admin: create client account
clientAuth.post('/accounts', authMiddleware, requireAdmin(), zValidator('json', createClientAccountSchema), async (c) => {
  const input = c.req.valid('json');
  const account = await clientAuthService.createAccount(input);
  return c.json(account, 201);
});

export default clientAuth;

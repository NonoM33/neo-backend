import type { Context, Next } from 'hono';
import { verify } from 'jsonwebtoken';
import { env } from '../config/env';
import { db } from '../config/database';
import { clientAccounts } from '../db/schema';
import { eq } from 'drizzle-orm';
import { UnauthorizedError } from '../lib/errors';

export interface ClientJWTPayload {
  clientAccountId: string;
  clientId: string;
  email: string;
  type: 'client';
}

declare module 'hono' {
  interface ContextVariableMap {
    clientAccount: ClientJWTPayload;
    clientId: string;
    clientAccountId: string;
  }
}

export async function clientAuthMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Token manquant');
  }

  const token = authHeader.substring(7);
  const secret = env.CLIENT_JWT_SECRET || env.JWT_SECRET;

  try {
    const payload = verify(token, secret) as ClientJWTPayload;

    if (payload.type !== 'client') {
      throw new UnauthorizedError('Token invalide');
    }

    const [account] = await db
      .select({ id: clientAccounts.id, isActive: clientAccounts.isActive })
      .from(clientAccounts)
      .where(eq(clientAccounts.id, payload.clientAccountId))
      .limit(1);

    if (!account) {
      throw new UnauthorizedError('Compte client non trouvé');
    }

    if (!account.isActive) {
      throw new UnauthorizedError('Compte client désactivé');
    }

    c.set('clientAccount', payload);
    c.set('clientId', payload.clientId);
    c.set('clientAccountId', payload.clientAccountId);

    await next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    throw new UnauthorizedError('Token invalide ou expiré');
  }
}

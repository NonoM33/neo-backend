import { sign, verify } from 'jsonwebtoken';
import { hash, verify as verifyPassword } from 'argon2';
import { eq, and, gt } from 'drizzle-orm';
import { db } from '../../config/database';
import { clientAccounts, clientRefreshTokens, clients } from '../../db/schema';
import { env } from '../../config/env';
import { UnauthorizedError, NotFoundError, ConflictError } from '../../lib/errors';
import type { ClientJWTPayload } from '../middleware/client-auth.middleware';
import type { CreateClientAccountInput } from './auth.schema';

function parseExpiration(expiresIn: string | undefined): number {
  if (!expiresIn) {
    return 7 * 24 * 60 * 60 * 1000; // Default 7 days
  }
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match || !match[1] || !match[2]) {
    return 7 * 24 * 60 * 60 * 1000; // Default 7 days
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return 7 * 24 * 60 * 60 * 1000;
  }
}

function generateAccessToken(payload: ClientJWTPayload): string {
  const secret = env.CLIENT_JWT_SECRET || env.JWT_SECRET;
  return sign(payload, secret, {
    expiresIn: env.CLIENT_JWT_EXPIRES_IN as string,
  } as any);
}

function generateRefreshToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export async function createAccount(input: CreateClientAccountInput) {
  // Verify client exists
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, input.clientId))
    .limit(1);

  if (!client) {
    throw new NotFoundError('Client');
  }

  // Check email uniqueness
  const [existing] = await db
    .select({ id: clientAccounts.id })
    .from(clientAccounts)
    .where(eq(clientAccounts.email, input.email))
    .limit(1);

  if (existing) {
    throw new ConflictError('Un compte avec cet email existe déjà');
  }

  const hashedPassword = await hash(input.password);

  const [account] = await db
    .insert(clientAccounts)
    .values({
      clientId: input.clientId,
      email: input.email,
      password: hashedPassword,
    })
    .returning({
      id: clientAccounts.id,
      clientId: clientAccounts.clientId,
      email: clientAccounts.email,
      isActive: clientAccounts.isActive,
      createdAt: clientAccounts.createdAt,
    });

  return account;
}

export async function login(email: string, password: string) {
  const [account] = await db
    .select()
    .from(clientAccounts)
    .where(eq(clientAccounts.email, email))
    .limit(1);

  if (!account) {
    throw new UnauthorizedError('Email ou mot de passe incorrect');
  }

  if (!account.isActive) {
    throw new UnauthorizedError('Compte désactivé');
  }

  const validPassword = await verifyPassword(account.password, password);
  if (!validPassword) {
    throw new UnauthorizedError('Email ou mot de passe incorrect');
  }

  // Update lastLoginAt
  await db
    .update(clientAccounts)
    .set({ lastLoginAt: new Date() })
    .where(eq(clientAccounts.id, account.id));

  const payload: ClientJWTPayload = {
    clientAccountId: account.id,
    clientId: account.clientId,
    email: account.email,
    type: 'client',
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken();

  const expiresAt = new Date(Date.now() + parseExpiration(env.CLIENT_JWT_REFRESH_EXPIRES_IN));

  await db.insert(clientRefreshTokens).values({
    clientAccountId: account.id,
    token: refreshToken,
    expiresAt,
  });

  // Fetch client info for response
  const [client] = await db
    .select({
      firstName: clients.firstName,
      lastName: clients.lastName,
    })
    .from(clients)
    .where(eq(clients.id, account.clientId))
    .limit(1);

  return {
    accessToken,
    refreshToken,
    client: {
      clientAccountId: account.id,
      clientId: account.clientId,
      email: account.email,
      firstName: client?.firstName ?? null,
      lastName: client?.lastName ?? null,
    },
  };
}

export async function refresh(refreshToken: string) {
  const [token] = await db
    .select()
    .from(clientRefreshTokens)
    .where(
      and(
        eq(clientRefreshTokens.token, refreshToken),
        gt(clientRefreshTokens.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!token) {
    throw new UnauthorizedError('Refresh token invalide ou expiré');
  }

  const [account] = await db
    .select()
    .from(clientAccounts)
    .where(eq(clientAccounts.id, token.clientAccountId))
    .limit(1);

  if (!account) {
    throw new UnauthorizedError('Compte client non trouvé');
  }

  if (!account.isActive) {
    throw new UnauthorizedError('Compte désactivé');
  }

  // Delete old refresh token
  await db.delete(clientRefreshTokens).where(eq(clientRefreshTokens.id, token.id));

  const payload: ClientJWTPayload = {
    clientAccountId: account.id,
    clientId: account.clientId,
    email: account.email,
    type: 'client',
  };

  const accessToken = generateAccessToken(payload);
  const newRefreshToken = generateRefreshToken();

  const expiresAt = new Date(Date.now() + parseExpiration(env.CLIENT_JWT_REFRESH_EXPIRES_IN));

  await db.insert(clientRefreshTokens).values({
    clientAccountId: account.id,
    token: newRefreshToken,
    expiresAt,
  });

  return {
    accessToken,
    refreshToken: newRefreshToken,
  };
}

export async function logout(refreshToken: string) {
  await db.delete(clientRefreshTokens).where(eq(clientRefreshTokens.token, refreshToken));
}

export async function getMe(clientAccountId: string) {
  const [result] = await db
    .select({
      clientAccountId: clientAccounts.id,
      clientId: clientAccounts.clientId,
      email: clientAccounts.email,
      isActive: clientAccounts.isActive,
      lastLoginAt: clientAccounts.lastLoginAt,
      firstName: clients.firstName,
      lastName: clients.lastName,
      phone: clients.phone,
    })
    .from(clientAccounts)
    .innerJoin(clients, eq(clientAccounts.clientId, clients.id))
    .where(eq(clientAccounts.id, clientAccountId))
    .limit(1);

  if (!result) {
    throw new UnauthorizedError('Compte client non trouvé');
  }

  return result;
}

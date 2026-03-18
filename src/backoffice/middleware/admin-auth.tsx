import type { Context, Next } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { db } from '../../config/database';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { sign, verify } from 'jsonwebtoken';
import { env } from '../../config/env';

const SESSION_COOKIE = 'backoffice_session';
const SESSION_EXPIRY = 60 * 60 * 24; // 24 hours in seconds

interface SessionPayload {
  userId: string;
}

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'integrateur' | 'auditeur';
}

export async function createSession(c: Context, user: AdminUser): Promise<void> {
  const payload: SessionPayload = {
    userId: user.id,
  };

  const token = sign(payload, env.JWT_SECRET, {
    expiresIn: SESSION_EXPIRY,
  });

  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: SESSION_EXPIRY,
    path: '/backoffice',
  });
}

export function destroySession(c: Context): void {
  deleteCookie(c, SESSION_COOKIE, {
    path: '/backoffice',
  });
}

export async function getSessionUser(c: Context): Promise<AdminUser | null> {
  const token = getCookie(c, SESSION_COOKIE);

  if (!token) {
    return null;
  }

  try {
    const payload = verify(token, env.JWT_SECRET) as SessionPayload;

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (!user) {
      return null;
    }

    return user as AdminUser;
  } catch {
    return null;
  }
}

export async function requireAdmin(c: Context, next: Next) {
  const user = await getSessionUser(c);

  if (!user) {
    return c.redirect('/backoffice/login');
  }

  if (user.role !== 'admin') {
    return c.redirect('/backoffice/login?error=access_denied');
  }

  c.set('adminUser', user);
  await next();
}

export async function optionalAuth(c: Context, next: Next) {
  const user = await getSessionUser(c);
  if (user) {
    c.set('adminUser', user);
  }
  await next();
}

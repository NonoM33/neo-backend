import type { Context, Next } from 'hono';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const store = new Map<string, { count: number; resetAt: number }>();

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 300_000).unref();

export function rateLimit(config: RateLimitConfig) {
  return async (c: Context, next: Next) => {
    const ip =
      c.req.header('x-forwarded-for') ||
      c.req.header('x-real-ip') ||
      'unknown';
    const key = `${ip}:${c.req.path}`;
    const now = Date.now();

    let entry = store.get(key);
    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + config.windowMs };
      store.set(key, entry);
    }

    entry.count++;

    c.header('X-RateLimit-Limit', String(config.maxRequests));
    c.header('X-RateLimit-Remaining', String(Math.max(0, config.maxRequests - entry.count)));
    c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > config.maxRequests) {
      return c.json(
        {
          error: {
            message: 'Trop de requ\u00eates. Veuillez r\u00e9essayer plus tard.',
            code: 'RATE_LIMITED',
          },
        },
        429
      );
    }

    await next();
  };
}

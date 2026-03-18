import { Hono } from 'hono';
import { randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../../config/database';
import { calendarSyncTokens } from '../../db/schema/calendar-sync';
import { authMiddleware } from '../../middleware/auth.middleware';
import type { JWTPayload } from '../../middleware/auth.middleware';
import { generateICalFeed } from './ical.service';
import { NotFoundError } from '../../lib/errors';

const calendarSyncRouter = new Hono();

// ─── POST /api/calendar/generate-token ───────────────────────────────────────
// Authenticated endpoint. Generates (or regenerates) a personal iCal feed
// token for the current user.
calendarSyncRouter.post('/generate-token', authMiddleware, async (c) => {
  const user = c.get('user') as JWTPayload;
  const token = randomBytes(48).toString('hex'); // 96-char token

  // Upsert: remove any existing token, then create a new one
  await db
    .delete(calendarSyncTokens)
    .where(eq(calendarSyncTokens.userId, user.userId));

  const [record] = await db
    .insert(calendarSyncTokens)
    .values({
      userId: user.userId,
      token,
    })
    .returning();

  const feedUrl = `/api/calendar/${user.userId}/feed.ics?token=${token}`;

  return c.json(
    {
      token,
      feedUrl,
      userId: user.userId,
      message:
        "Token g\u00e9n\u00e9r\u00e9. Utilisez l'URL du feed dans votre application de calendrier.",
    },
    201
  );
});

// ─── DELETE /api/calendar/revoke-token ───────────────────────────────────────
// Authenticated endpoint. Revokes the user's calendar feed token.
calendarSyncRouter.delete('/revoke-token', authMiddleware, async (c) => {
  const user = c.get('user') as JWTPayload;

  const result = await db
    .delete(calendarSyncTokens)
    .where(eq(calendarSyncTokens.userId, user.userId))
    .returning();

  if (result.length === 0) {
    throw new NotFoundError('Aucun token de calendrier trouv\u00e9');
  }

  return c.json({ message: 'Token r\u00e9voqu\u00e9' });
});

// ─── GET /api/calendar/:userId/feed.ics ──────────────────────────────────────
// Public (token-authenticated) iCal feed. Calendar apps (Google Calendar,
// Apple Calendar, Outlook) poll this URL periodically.
calendarSyncRouter.get('/:userId/feed.ics', async (c) => {
  const userId = c.req.param('userId');
  const token = c.req.query('token');

  if (!token) {
    return c.json(
      { error: { message: 'Token requis', code: 'UNAUTHORIZED' } },
      401
    );
  }

  // Validate token belongs to this user
  const [record] = await db
    .select()
    .from(calendarSyncTokens)
    .where(eq(calendarSyncTokens.userId, userId))
    .limit(1);

  if (!record || record.token !== token) {
    return c.json(
      { error: { message: 'Token invalide', code: 'UNAUTHORIZED' } },
      401
    );
  }

  // Track last access time (fire-and-forget, don't block the response)
  db.update(calendarSyncTokens)
    .set({ lastAccessedAt: new Date() })
    .where(eq(calendarSyncTokens.id, record.id))
    .then(() => {})
    .catch(() => {});

  // Generate the iCal content
  const icalContent = await generateICalFeed(userId);

  return new Response(icalContent, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="neo-domotique.ics"',
      'Cache-Control': 'max-age=300', // 5-minute cache
    },
  });
});

export default calendarSyncRouter;

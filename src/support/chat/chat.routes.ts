import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { zValidator } from '@hono/zod-validator';
import {
  createSessionSchema,
  sendMessageSchema,
  updateSessionSchema,
  rateSessionSchema,
} from './chat.schema';
import * as chatService from './chat.service';
import { processMessage } from './chat.llm';
import { buildClientContext } from './chat.context';
import { clientAuthMiddleware } from '../middleware/client-auth.middleware';

const chatRouter = new Hono();

chatRouter.use('*', clientAuthMiddleware);

// Create session
chatRouter.post('/sessions', zValidator('json', createSessionSchema), async (c) => {
  const clientAccountId = c.get('clientAccountId');
  const clientId = c.get('clientId');
  const input = c.req.valid('json');
  const session = await chatService.createSession(clientAccountId, clientId, input);
  return c.json(session, 201);
});

// List sessions
chatRouter.get('/sessions', async (c) => {
  const clientAccountId = c.get('clientAccountId');
  const sessions = await chatService.getSessions(clientAccountId);
  return c.json({ data: sessions });
});

// Get session with messages
chatRouter.get('/sessions/:id', async (c) => {
  const clientAccountId = c.get('clientAccountId');
  const sessionId = c.req.param('id');
  const session = await chatService.getSessionById(sessionId, clientAccountId);
  return c.json(session);
});

// Send message with SSE response
chatRouter.post(
  '/sessions/:id/messages',
  zValidator('json', sendMessageSchema),
  async (c) => {
    const clientAccountId = c.get('clientAccountId');
    const sessionId = c.req.param('id');
    const { content } = c.req.valid('json');

    // Verify session belongs to client and is active
    const session = await chatService.getSessionById(sessionId, clientAccountId);
    if (session.status !== 'active') {
      return c.json({ error: { message: 'Session fermée', code: 'SESSION_CLOSED' } }, 400);
    }

    // Check message limit
    const msgCount = await chatService.getMessageCount(sessionId);
    if (msgCount >= 50) {
      return c.json({ error: { message: 'Limite de messages atteinte (50/session)', code: 'MESSAGE_LIMIT' } }, 400);
    }

    // Store user message
    await chatService.addMessage(sessionId, 'user', content);

    // Build client context
    const ctx = await buildClientContext(clientAccountId, sessionId);

    // Stream response via SSE
    return streamSSE(c, async (stream) => {
      try {
        const response = await processMessage(ctx, sessionId, content, (chunk) => {
          stream.writeSSE({ data: JSON.stringify({ type: 'text', content: chunk }) });
        });

        stream.writeSSE({
          data: JSON.stringify({ type: 'done', content: response }),
        });
      } catch (error: any) {
        stream.writeSSE({
          data: JSON.stringify({
            type: 'error',
            content: 'Une erreur est survenue. Veuillez réessayer.',
          }),
        });
      }
    });
  }
);

// Update session (close/resolve)
chatRouter.patch(
  '/sessions/:id',
  zValidator('json', updateSessionSchema),
  async (c) => {
    const clientAccountId = c.get('clientAccountId');
    const sessionId = c.req.param('id');
    const input = c.req.valid('json');
    const session = await chatService.updateSession(sessionId, clientAccountId, input);
    return c.json(session);
  }
);

// Rate session
chatRouter.post(
  '/sessions/:id/rate',
  zValidator('json', rateSessionSchema),
  async (c) => {
    const clientAccountId = c.get('clientAccountId');
    const sessionId = c.req.param('id');
    const input = c.req.valid('json');
    const session = await chatService.rateSession(sessionId, clientAccountId, input);
    return c.json(session);
  }
);

export default chatRouter;

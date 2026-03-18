import { eq, and, desc, count, sql } from 'drizzle-orm';
import { db } from '../../config/database';
import { chatSessions, chatMessages } from '../../db/schema';
import { NotFoundError, ForbiddenError, ValidationError } from '../../lib/errors';
import type { CreateSessionInput, UpdateSessionInput, RateSessionInput } from './chat.schema';

const MAX_SESSIONS_PER_DAY = 5;
const MAX_MESSAGES_PER_SESSION = 50;

export async function createSession(clientAccountId: string, clientId: string, input: CreateSessionInput) {
  // Check daily session limit
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [sessionCount] = await db
    .select({ total: count() })
    .from(chatSessions)
    .where(
      and(
        eq(chatSessions.clientAccountId, clientAccountId),
        sql`${chatSessions.createdAt} >= ${today}`
      )
    );

  if ((sessionCount?.total ?? 0) >= MAX_SESSIONS_PER_DAY) {
    throw new ValidationError('Limite de sessions quotidiennes atteinte (5/jour)');
  }

  const [session] = await db
    .insert(chatSessions)
    .values({
      clientAccountId,
      clientId,
      subject: input.subject,
      status: 'active',
    })
    .returning();

  return session;
}

export async function getSessions(clientAccountId: string) {
  return db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.clientAccountId, clientAccountId))
    .orderBy(desc(chatSessions.createdAt));
}

export async function getSessionById(sessionId: string, clientAccountId: string) {
  const [session] = await db
    .select()
    .from(chatSessions)
    .where(
      and(
        eq(chatSessions.id, sessionId),
        eq(chatSessions.clientAccountId, clientAccountId)
      )
    )
    .limit(1);

  if (!session) {
    throw new NotFoundError('Session de chat');
  }

  const messages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(chatMessages.createdAt);

  return { ...session, messages };
}

export async function addMessage(
  sessionId: string,
  role: 'user' | 'assistant' | 'system' | 'tool_call' | 'tool_result',
  content: string | null,
  extra?: { toolName?: string; toolInput?: any; toolOutput?: any; tokenCount?: number; modelId?: string }
) {
  const [message] = await db
    .insert(chatMessages)
    .values({
      sessionId,
      role,
      content,
      toolName: extra?.toolName,
      toolInput: extra?.toolInput,
      toolOutput: extra?.toolOutput,
      tokenCount: extra?.tokenCount,
      modelId: extra?.modelId,
    })
    .returning();

  // Update session counters
  await db
    .update(chatSessions)
    .set({
      messageCount: sql`${chatSessions.messageCount} + 1`,
      toolCallCount:
        role === 'tool_call'
          ? sql`${chatSessions.toolCallCount} + 1`
          : chatSessions.toolCallCount,
      totalTokens: extra?.tokenCount
        ? sql`${chatSessions.totalTokens} + ${extra.tokenCount}`
        : chatSessions.totalTokens,
      updatedAt: new Date(),
    })
    .where(eq(chatSessions.id, sessionId));

  return message;
}

export async function getMessageCount(sessionId: string): Promise<number> {
  const [result] = await db
    .select({ total: count() })
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.sessionId, sessionId),
        eq(chatMessages.role, 'user')
      )
    );
  return result?.total ?? 0;
}

export async function getSessionMessages(sessionId: string) {
  return db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(chatMessages.createdAt);
}

export async function updateSession(
  sessionId: string,
  clientAccountId: string,
  input: UpdateSessionInput
) {
  const [session] = await db
    .select()
    .from(chatSessions)
    .where(
      and(
        eq(chatSessions.id, sessionId),
        eq(chatSessions.clientAccountId, clientAccountId)
      )
    )
    .limit(1);

  if (!session) {
    throw new NotFoundError('Session de chat');
  }

  const updates: any = { status: input.status, updatedAt: new Date() };
  if (input.status === 'closed' || input.status === 'resolved') {
    updates.closedAt = new Date();
  }

  const [updated] = await db
    .update(chatSessions)
    .set(updates)
    .where(eq(chatSessions.id, sessionId))
    .returning();

  return updated;
}

export async function markSessionEscalated(sessionId: string) {
  await db
    .update(chatSessions)
    .set({ status: 'escalated', updatedAt: new Date() })
    .where(eq(chatSessions.id, sessionId));
}

export async function rateSession(
  sessionId: string,
  clientAccountId: string,
  input: RateSessionInput
) {
  const [session] = await db
    .select()
    .from(chatSessions)
    .where(
      and(
        eq(chatSessions.id, sessionId),
        eq(chatSessions.clientAccountId, clientAccountId)
      )
    )
    .limit(1);

  if (!session) {
    throw new NotFoundError('Session de chat');
  }

  const [updated] = await db
    .update(chatSessions)
    .set({
      satisfactionRating: input.rating,
      satisfactionComment: input.comment,
      updatedAt: new Date(),
    })
    .where(eq(chatSessions.id, sessionId))
    .returning();

  return updated;
}

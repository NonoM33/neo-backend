/**
 * In-memory scan session storage.
 * Sessions are short-lived (10 min) — no database needed.
 */

export interface ScanSession {
  id: string;
  roomId: string;
  projectId: string;
  roomName: string;
  status: 'pending' | 'scanning' | 'completed' | 'expired';
  plan: any | null;
  createdAt: Date;
}

const sessions = new Map<string, ScanSession>();

// Auto-cleanup expired sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  const keys = Array.from(sessions.keys());
  for (const id of keys) {
    const session = sessions.get(id)!;
    if (now - session.createdAt.getTime() > 10 * 60 * 1000) {
      sessions.delete(id);
    }
  }
}, 5 * 60 * 1000);

export function createSession(data: {
  id: string;
  roomId: string;
  projectId: string;
  roomName?: string;
}): ScanSession {
  const session: ScanSession = {
    id: data.id,
    roomId: data.roomId,
    projectId: data.projectId,
    roomName: data.roomName || '',
    status: 'pending',
    plan: null,
    createdAt: new Date(),
  };
  sessions.set(data.id, session);
  return session;
}

export function getSession(id: string): ScanSession | undefined {
  return sessions.get(id);
}

export function updateSessionStatus(id: string, status: ScanSession['status']): ScanSession | undefined {
  const session = sessions.get(id);
  if (!session) return undefined;
  session.status = status;
  return session;
}

export function uploadSessionResult(id: string, plan: any): ScanSession | undefined {
  const session = sessions.get(id);
  if (!session) return undefined;
  session.plan = plan;
  session.status = 'completed';
  return session;
}

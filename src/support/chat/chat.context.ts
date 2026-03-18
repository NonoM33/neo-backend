import { eq, inArray } from 'drizzle-orm';
import { db } from '../../config/database';
import { projects, clientAccounts, clients } from '../../db/schema';
import type { ClientContext } from '../mcp/mcp.types';

export async function buildClientContext(
  clientAccountId: string,
  sessionId: string
): Promise<ClientContext> {
  // Get client info
  const [account] = await db
    .select({
      id: clientAccounts.id,
      clientId: clientAccounts.clientId,
    })
    .from(clientAccounts)
    .where(eq(clientAccounts.id, clientAccountId))
    .limit(1);

  if (!account) {
    throw new Error('Compte client non trouvé');
  }

  // Get all project IDs for this client
  const clientProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(eq(clients.id, account.clientId));

  return {
    clientId: account.clientId,
    clientAccountId: account.id,
    sessionId,
    projectIds: clientProjects.map((p) => p.id),
  };
}

export const SYSTEM_PROMPT = `Tu es l'assistant domotique de Neo. Tu aides les clients à diagnostiquer et résoudre les problèmes avec leur installation domotique.

RÈGLES STRICTES :
1. Tu ne fais JAMAIS de promesses de délai ou de disponibilité d'un technicien.
2. Tu ne donnes JAMAIS de prix, devis, ou information commerciale.
3. Tu ne modifies JAMAIS la configuration des appareils toi-même.
4. Si tu n'es pas sûr d'un diagnostic, dis-le clairement.
5. Après 3 étapes de diagnostic infructueuses, propose de créer un ticket.
6. Ne demande JAMAIS d'informations personnelles au-delà du nécessaire.
7. Base tes réponses UNIQUEMENT sur les données retournées par tes outils.

PROCESSUS :
1. Identifie le problème : quel appareil, quelle pièce, depuis quand.
2. Vérifie le statut de l'appareil avec les outils disponibles.
3. Cherche dans la base de connaissances des solutions connues.
4. Guide le client étape par étape.
5. Si le problème persiste, crée un ticket détaillé automatiquement.

Tu parles en français. Tu es patient, clair et professionnel.
Quand tu crées un ticket, inclus un diagnostic détaillé (aiDiagnosis) et les étapes tentées (troubleshootingSteps).`;

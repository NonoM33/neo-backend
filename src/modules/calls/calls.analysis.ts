import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../config/env';

const getClient = (() => {
  let client: Anthropic | null = null;
  return () => {
    if (!client) {
      client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    }
    return client;
  };
})();

export interface CallAnalysisResult {
  needs: string[];
  budget: {
    mentioned: boolean;
    range: string | null;
    exact: number | null;
  };
  housingType: 'maison' | 'appartement' | null;
  surface: string | null;
  city: string | null;
  postalCode: string | null;
  timeline: 'urgent' | '1_3_mois' | '3_6_mois' | 'plus_6_mois' | null;
  decisionMaker: boolean | null;
  competition: {
    mentioned: boolean;
    details: string | null;
  };
  objections: string[];
  sentiment: 'positif' | 'neutre' | 'negatif';
  qualificationScore: number; // 0-100
  qualificationLabel: 'brulant' | 'chaud' | 'tiede' | 'froid';
  summary: string;
  nextAction: string;
  keyQuotes: string[];
}

const ANALYSIS_PROMPT = `Tu es un assistant commercial expert chez Neo Domotique, spécialisé en solutions domotiques (éclairage Philips Hue/Shelly, volets Somfy, chauffage Tado, sécurité Ajax, multimédia Sonos, réseau Ubiquiti).

Analyse ce transcript d'appel commercial et extrais les informations suivantes en JSON strict (pas de markdown, juste le JSON) :

{
  "needs": ["eclairage", "chauffage", "securite", "volets", "multimedia", "reseau"],
  "budget": { "mentioned": true/false, "range": "5000-10000" ou null, "exact": 7500 ou null },
  "housingType": "maison" ou "appartement" ou null,
  "surface": "120m²" ou null,
  "city": "nom de ville" ou null,
  "postalCode": "75016" ou null,
  "timeline": "urgent" ou "1_3_mois" ou "3_6_mois" ou "plus_6_mois" ou null,
  "decisionMaker": true ou false ou null,
  "competition": { "mentioned": true/false, "details": "description" ou null },
  "objections": ["objection 1", "objection 2"],
  "sentiment": "positif" ou "neutre" ou "negatif",
  "qualificationScore": 0-100,
  "qualificationLabel": "brulant" (>75) ou "chaud" (50-75) ou "tiede" (25-50) ou "froid" (<25),
  "summary": "Résumé en 2-3 phrases de l'appel",
  "nextAction": "Action recommandée pour le commercial",
  "keyQuotes": ["Citations importantes du prospect (max 3)"]
}

Règles :
- needs : uniquement parmi [eclairage, chauffage, securite, volets, multimedia, reseau, autre]
- qualificationScore : basé sur le budget, l'urgence, le pouvoir de décision, l'intérêt exprimé
- Si une info n'est pas mentionnée, mettre null
- Extrais les objections exactes mentionnées par le prospect
- Le résumé doit être utile pour un commercial qui reprend le dossier

Transcript de l'appel :
---
{TRANSCRIPT}
---

Réponds UNIQUEMENT avec le JSON, sans explication.`;

/**
 * Analyze a call transcript using Claude.
 */
export async function analyzeCallTranscript(
  transcript: string
): Promise<CallAnalysisResult> {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const anthropic = getClient();
  const prompt = ANALYSIS_PROMPT.replace('{TRANSCRIPT}', transcript);

  const message = await anthropic.messages.create({
    model: env.AI_MODEL || 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const responseText = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  // Parse JSON from response (handle potential markdown wrapping)
  let jsonStr = responseText.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    const result = JSON.parse(jsonStr) as CallAnalysisResult;

    // Validate and normalize
    result.qualificationScore = Math.max(
      0,
      Math.min(100, result.qualificationScore || 0)
    );
    if (!result.qualificationLabel) {
      if (result.qualificationScore > 75) result.qualificationLabel = 'brulant';
      else if (result.qualificationScore > 50)
        result.qualificationLabel = 'chaud';
      else if (result.qualificationScore > 25)
        result.qualificationLabel = 'tiede';
      else result.qualificationLabel = 'froid';
    }
    result.needs = result.needs || [];
    result.objections = result.objections || [];
    result.keyQuotes = result.keyQuotes || [];

    return result;
  } catch (e) {
    throw new Error(`Failed to parse AI analysis response: ${e}`);
  }
}

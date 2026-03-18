import { eq, and, desc, gte, lte, SQL } from 'drizzle-orm';
import { db } from '../../config/database';
import { callRecordings } from '../../db/schema/calls';
import { leads, activities } from '../../db/schema/crm';
import { NotFoundError, ForbiddenError } from '../../lib/errors';
import { isAdmin } from '../../middleware/rbac.middleware';
import type { JWTPayload } from '../../middleware/auth.middleware';
import { transcribeAudio } from './calls.transcription';
import { analyzeCallTranscript } from './calls.analysis';
import { uploadFile, deleteFile } from '../../config/s3';
import { env } from '../../config/env';
import type { CallFilter } from './calls.schema';

/**
 * Upload audio to S3, create DB record, and trigger async processing pipeline.
 * Returns immediately with the record in 'transcribing' status.
 */
export async function uploadCall(
  audioBuffer: Buffer,
  filename: string,
  mimeType: string,
  leadId: string | undefined,
  user: JWTPayload
) {
  const bucket = env.S3_BUCKET_DOCUMENTS;
  const key = `calls/${user.userId}/${Date.now()}_${filename}`;

  // Upload to S3/MinIO
  const audioUrl = await uploadFile(bucket, key, audioBuffer, mimeType);

  // Create DB record
  const [record] = await db
    .insert(callRecordings)
    .values({
      leadId: leadId || null,
      audioKey: key,
      audioBucket: bucket,
      audioUrl,
      fileSize: audioBuffer.byteLength,
      mimeType,
      status: 'transcribing',
      createdBy: user.userId,
    })
    .returning();

  if (!record) {
    throw new Error('Failed to create call recording');
  }

  // Process async (don't await - return immediately)
  processCall(record.id, audioBuffer).catch((err) => {
    console.error(`Call processing failed for ${record.id}:`, err);
  });

  return record;
}

/**
 * Async processing pipeline: transcribe audio -> analyze with Claude.
 * Updates the DB record at each step.
 */
async function processCall(callId: string, audioBuffer: Buffer) {
  try {
    // Step 1: Transcribe with Whisper
    const transcription = await transcribeAudio(audioBuffer);

    await db
      .update(callRecordings)
      .set({
        transcription: transcription.text,
        transcriptionLanguage: transcription.language,
        duration: Math.round(transcription.duration),
        status: 'analyzing',
        updatedAt: new Date(),
      })
      .where(eq(callRecordings.id, callId));

    // Step 2: Analyze with Claude (only if transcript is long enough)
    if (transcription.text.trim().length > 20) {
      const analysis = await analyzeCallTranscript(transcription.text);

      await db
        .update(callRecordings)
        .set({
          aiAnalysis: analysis as any,
          status: 'done',
          updatedAt: new Date(),
        })
        .where(eq(callRecordings.id, callId));

      // Auto-create activity linked to the lead
      const [call] = await db
        .select()
        .from(callRecordings)
        .where(eq(callRecordings.id, callId))
        .limit(1);

      if (call?.leadId) {
        const [activity] = await db
          .insert(activities)
          .values({
            leadId: call.leadId,
            type: 'appel',
            subject: `Appel enregistré - ${analysis.summary?.substring(0, 100) || 'Appel commercial'}`,
            description: analysis.summary || null,
            status: 'termine',
            scheduledAt: call.createdAt,
            completedAt: new Date(),
            duration: call.duration ? Math.round(call.duration / 60) : null,
            ownerId: call.createdBy,
            metadata: {
              callRecordingId: callId,
              qualificationScore: analysis.qualificationScore,
            },
          })
          .returning();

        // Link activity to call
        if (activity) {
          await db
            .update(callRecordings)
            .set({
              activityId: activity.id,
              updatedAt: new Date(),
            })
            .where(eq(callRecordings.id, callId));
        }
      }
    } else {
      // Transcript too short for meaningful analysis
      await db
        .update(callRecordings)
        .set({
          status: 'done',
          updatedAt: new Date(),
        })
        .where(eq(callRecordings.id, callId));
    }
  } catch (error: any) {
    await db
      .update(callRecordings)
      .set({
        status: 'error',
        errorMessage: error.message || 'Unknown error',
        updatedAt: new Date(),
      })
      .where(eq(callRecordings.id, callId));
  }
}

/**
 * Get a call recording by ID. Enforces ownership for non-admins.
 */
export async function getCall(id: string, user: JWTPayload) {
  const [call] = await db
    .select()
    .from(callRecordings)
    .where(eq(callRecordings.id, id))
    .limit(1);

  if (!call) {
    throw new NotFoundError('Enregistrement');
  }

  if (!isAdmin(user) && call.createdBy !== user.userId) {
    throw new ForbiddenError('Accès non autorisé');
  }

  return call;
}

/**
 * Get all call recordings for a specific lead.
 */
export async function getCallsForLead(leadId: string, user: JWTPayload) {
  const calls = await db
    .select()
    .from(callRecordings)
    .where(eq(callRecordings.leadId, leadId))
    .orderBy(desc(callRecordings.createdAt));

  return calls;
}

/**
 * Get all calls for the current user (or all for admins), with optional filters.
 */
export async function getCalls(user: JWTPayload, filters: CallFilter) {
  const conditions: SQL[] = [];

  if (!isAdmin(user)) {
    conditions.push(eq(callRecordings.createdBy, user.userId));
  }
  if (filters.leadId) {
    conditions.push(eq(callRecordings.leadId, filters.leadId));
  }
  if (filters.status) {
    conditions.push(eq(callRecordings.status, filters.status as any));
  }
  if (filters.fromDate) {
    conditions.push(gte(callRecordings.createdAt, filters.fromDate));
  }
  if (filters.toDate) {
    conditions.push(lte(callRecordings.createdAt, filters.toDate));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  return db
    .select()
    .from(callRecordings)
    .where(where)
    .orderBy(desc(callRecordings.createdAt))
    .limit(100);
}

/**
 * Re-analyze an existing call recording with Claude.
 * Requires the call to already have a transcription.
 */
export async function reanalyzeCall(id: string, user: JWTPayload) {
  const call = await getCall(id, user);

  if (!call.transcription) {
    throw new Error('Pas de transcription disponible');
  }

  await db
    .update(callRecordings)
    .set({ status: 'analyzing', updatedAt: new Date() })
    .where(eq(callRecordings.id, id));

  try {
    const analysis = await analyzeCallTranscript(call.transcription);

    await db
      .update(callRecordings)
      .set({
        aiAnalysis: analysis as any,
        status: 'done',
        updatedAt: new Date(),
      })
      .where(eq(callRecordings.id, id));

    return { ...call, aiAnalysis: analysis, status: 'done' as const };
  } catch (error: any) {
    await db
      .update(callRecordings)
      .set({
        status: 'error',
        errorMessage: error.message,
        updatedAt: new Date(),
      })
      .where(eq(callRecordings.id, id));
    throw error;
  }
}

/**
 * Delete a call recording (DB record + S3 file).
 */
export async function deleteCall(id: string, user: JWTPayload) {
  const call = await getCall(id, user);

  // Delete from S3
  if (call.audioBucket && call.audioKey) {
    try {
      await deleteFile(call.audioBucket, call.audioKey);
    } catch (err) {
      console.error(`Failed to delete S3 file for call ${id}:`, err);
    }
  }

  await db.delete(callRecordings).where(eq(callRecordings.id, id));
}

/**
 * Apply AI analysis results to the associated lead.
 * Updates lead fields like budget, city, surface, probability, etc.
 */
export async function applyAnalysisToLead(callId: string, user: JWTPayload) {
  const call = await getCall(callId, user);

  if (!call.leadId) {
    throw new Error('Aucun lead associé');
  }
  if (!call.aiAnalysis) {
    throw new Error('Aucune analyse disponible');
  }

  const analysis = call.aiAnalysis as any;
  const updateData: Record<string, any> = { updatedAt: new Date() };

  // Extract budget
  if (analysis.budget?.exact) {
    updateData.estimatedValue = analysis.budget.exact.toString();
  } else if (analysis.budget?.range) {
    const match = analysis.budget.range.match(/(\d+)/);
    if (match) updateData.estimatedValue = match[1];
  }

  // Extract location
  if (analysis.city) updateData.city = analysis.city;
  if (analysis.postalCode) updateData.postalCode = analysis.postalCode;

  // Extract surface
  if (analysis.surface) {
    const surfaceMatch = analysis.surface.match(/(\d+)/);
    if (surfaceMatch) updateData.surface = surfaceMatch[1];
  }

  // Append analysis summary to lead description
  if (analysis.summary) {
    const [lead] = await db
      .select({ description: leads.description })
      .from(leads)
      .where(eq(leads.id, call.leadId))
      .limit(1);

    const existing = lead?.description || '';
    updateData.description = existing
      ? `${existing}\n\n--- Analyse appel du ${new Date().toLocaleDateString('fr-FR')} ---\n${analysis.summary}`
      : analysis.summary;
  }

  // Update probability based on qualification score
  if (analysis.qualificationScore) {
    updateData.probability = Math.min(analysis.qualificationScore, 95);
  }

  await db.update(leads).set(updateData).where(eq(leads.id, call.leadId));

  return {
    updated: true,
    fields: Object.keys(updateData).filter((k) => k !== 'updatedAt'),
  };
}

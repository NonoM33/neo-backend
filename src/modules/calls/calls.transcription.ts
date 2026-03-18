import { env } from '../../config/env';

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptionResult {
  text: string;
  language: string;
  duration: number;
  segments?: TranscriptionSegment[];
}

/**
 * Transcribe audio using faster-whisper server (OpenAI-compatible API).
 * POST /v1/audio/transcriptions with multipart form data.
 *
 * The faster-whisper server (fedirz/faster-whisper-server) exposes
 * an OpenAI-compatible endpoint at /v1/audio/transcriptions.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  filename: string = 'audio.webm',
  language: string = 'fr'
): Promise<TranscriptionResult> {
  const whisperUrl = env.WHISPER_URL;

  const formData = new FormData();
  formData.append('file', new Blob([audioBuffer]), filename);
  formData.append('model', 'Systran/faster-whisper-medium');
  formData.append('language', language);
  formData.append('response_format', 'verbose_json');

  const headers: Record<string, string> = {};
  if (env.WHISPER_API_KEY) {
    headers['Authorization'] = `Bearer ${env.WHISPER_API_KEY}`;
  }

  const response = await fetch(`${whisperUrl}/v1/audio/transcriptions`, {
    method: 'POST',
    body: formData,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Whisper transcription failed: ${response.status} ${errorBody}`
    );
  }

  const data: any = await response.json();

  return {
    text: data.text || '',
    language: data.language || language,
    duration: data.duration || 0,
    segments: data.segments?.map((s: any) => ({
      start: s.start,
      end: s.end,
      text: s.text,
    })),
  };
}

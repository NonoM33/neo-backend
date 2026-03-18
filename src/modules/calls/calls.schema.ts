import { z } from 'zod';

// Call status values
export const callStatusValues = [
  'uploading',
  'transcribing',
  'analyzing',
  'done',
  'error',
] as const;

// Upload call schema (validated from multipart form fields)
export const uploadCallSchema = z.object({
  leadId: z.string().uuid().optional(),
  mimeType: z.string().default('audio/webm'),
});

// Analyze call schema (for re-analysis)
export const analyzeCallSchema = z.object({
  language: z.string().min(2).max(10).default('fr'),
});

// Call filter schema (query params)
export const callFilterSchema = z.object({
  leadId: z.string().uuid().optional(),
  status: z.enum(callStatusValues).optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

// Type exports
export type UploadCallInput = z.infer<typeof uploadCallSchema>;
export type AnalyzeCallInput = z.infer<typeof analyzeCallSchema>;
export type CallFilter = z.infer<typeof callFilterSchema>;
export type CallStatus = (typeof callStatusValues)[number];

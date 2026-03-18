import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  integer,
  jsonb,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { leads, activities } from './crm';

export const callStatusEnum = pgEnum('call_status', [
  'uploading',
  'transcribing',
  'analyzing',
  'done',
  'error',
]);

export const callRecordings = pgTable('call_recordings', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
  activityId: uuid('activity_id').references(() => activities.id, { onDelete: 'set null' }),
  // Audio file
  audioUrl: text('audio_url'),
  audioBucket: varchar('audio_bucket', { length: 100 }),
  audioKey: varchar('audio_key', { length: 500 }),
  duration: integer('duration'), // seconds
  fileSize: integer('file_size'), // bytes
  mimeType: varchar('mime_type', { length: 100 }).default('audio/webm'),
  // Transcription
  transcription: text('transcription'),
  transcriptionLanguage: varchar('transcription_language', { length: 10 }).default('fr'),
  // AI Analysis
  aiAnalysis: jsonb('ai_analysis'), // CallAnalysisResult
  // Status
  status: callStatusEnum('status').notNull().default('uploading'),
  errorMessage: text('error_message'),
  // Audit
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type CallRecording = typeof callRecordings.$inferSelect;
export type NewCallRecording = typeof callRecordings.$inferInsert;

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  boolean,
  integer,
  jsonb,
} from 'drizzle-orm/pg-core';
import { clients } from './projects';
import { projects } from './projects';
import { devices } from './devices';
import { rooms } from './rooms';
import { users } from './users';

// ============ Enums ============

export const ticketStatusEnum = pgEnum('ticket_status', [
  'nouveau',
  'ouvert',
  'en_attente_client',
  'en_attente_interne',
  'escalade',
  'resolu',
  'ferme',
]);

export const ticketPriorityEnum = pgEnum('ticket_priority', [
  'basse',
  'normale',
  'haute',
  'urgente',
  'critique',
]);

export const ticketCategoryEnum = pgEnum('ticket_category', [
  'installation',
  'configuration',
  'panne',
  'facturation',
  'fonctionnalite',
  'formation',
  'autre',
]);

export const ticketSourceEnum = pgEnum('ticket_source', [
  'email',
  'telephone',
  'portail',
  'chat_ai',
  'backoffice',
  'api',
]);

export const commentTypeEnum = pgEnum('comment_type', ['public', 'interne']);

export const commentAuthorTypeEnum = pgEnum('comment_author_type', [
  'client',
  'staff',
  'ai',
]);

export const ticketChangeTypeEnum = pgEnum('ticket_change_type', [
  'status',
  'priority',
  'assignment',
  'category',
  'sla',
  'tag',
  'escalation',
  'custom',
]);

export const kbStatusEnum = pgEnum('kb_status', [
  'brouillon',
  'publie',
  'archive',
]);

export const chatSessionStatusEnum = pgEnum('chat_session_status', [
  'active',
  'resolved',
  'escalated',
  'closed',
]);

export const messageRoleEnum = pgEnum('message_role', [
  'user',
  'assistant',
  'system',
  'tool_call',
  'tool_result',
]);

// ============ Client Auth ============

export const clientAccounts = pgTable('client_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id')
    .notNull()
    .references(() => clients.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const clientRefreshTokens = pgTable('client_refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientAccountId: uuid('client_account_id')
    .notNull()
    .references(() => clientAccounts.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 500 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============ Ticket Categories ============

export const ticketCategories = pgTable('ticket_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  description: text('description'),
  parentId: uuid('parent_id'),
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============ SLA Definitions ============

export const slaDefinitions = pgTable('sla_definitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  priority: ticketPriorityEnum('priority'),
  categoryId: uuid('category_id').references(() => ticketCategories.id, {
    onDelete: 'set null',
  }),
  firstResponseMinutes: integer('first_response_minutes').notNull(),
  resolutionMinutes: integer('resolution_minutes').notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============ Chat Sessions ============

export const chatSessions = pgTable('chat_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientAccountId: uuid('client_account_id')
    .notNull()
    .references(() => clientAccounts.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id')
    .notNull()
    .references(() => clients.id, { onDelete: 'cascade' }),
  status: chatSessionStatusEnum('status').notNull().default('active'),
  subject: varchar('subject', { length: 255 }),
  summary: text('summary'),
  messageCount: integer('message_count').notNull().default(0),
  toolCallCount: integer('tool_call_count').notNull().default(0),
  totalTokens: integer('total_tokens').notNull().default(0),
  satisfactionRating: integer('satisfaction_rating'),
  satisfactionComment: text('satisfaction_comment'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  closedAt: timestamp('closed_at'),
});

// ============ Tickets ============

export const tickets = pgTable('tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  number: varchar('number', { length: 20 }).notNull().unique(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  status: ticketStatusEnum('status').notNull().default('nouveau'),
  priority: ticketPriorityEnum('priority').notNull().default('normale'),
  source: ticketSourceEnum('source').notNull().default('portail'),
  categoryId: uuid('category_id').references(() => ticketCategories.id, {
    onDelete: 'set null',
  }),
  clientId: uuid('client_id')
    .notNull()
    .references(() => clients.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, {
    onDelete: 'set null',
  }),
  deviceId: uuid('device_id').references(() => devices.id, {
    onDelete: 'set null',
  }),
  roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'set null' }),
  reportedById: uuid('reported_by_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  assignedToId: uuid('assigned_to_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  slaDefinitionId: uuid('sla_definition_id').references(
    () => slaDefinitions.id,
    { onDelete: 'set null' }
  ),
  firstResponseAt: timestamp('first_response_at'),
  firstResponseDueAt: timestamp('first_response_due_at'),
  resolutionDueAt: timestamp('resolution_due_at'),
  resolvedAt: timestamp('resolved_at'),
  closedAt: timestamp('closed_at'),
  slaBreached: boolean('sla_breached').notNull().default(false),
  escalationLevel: integer('escalation_level').notNull().default(0),
  tags: text('tags').array(),
  chatSessionId: uuid('chat_session_id').references(() => chatSessions.id, {
    onDelete: 'set null',
  }),
  aiDiagnosis: text('ai_diagnosis'),
  troubleshootingSteps: jsonb('troubleshooting_steps'),
  satisfactionRating: integer('satisfaction_rating'),
  satisfactionComment: text('satisfaction_comment'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============ Ticket Comments ============

export const ticketComments = pgTable('ticket_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id')
    .notNull()
    .references(() => tickets.id, { onDelete: 'cascade' }),
  authorType: commentAuthorTypeEnum('author_type').notNull(),
  authorId: uuid('author_id'),
  type: commentTypeEnum('type').notNull().default('public'),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============ Ticket Attachments ============

export const ticketAttachments = pgTable('ticket_attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id')
    .notNull()
    .references(() => tickets.id, { onDelete: 'cascade' }),
  commentId: uuid('comment_id').references(() => ticketComments.id, {
    onDelete: 'set null',
  }),
  filename: varchar('filename', { length: 255 }).notNull(),
  url: text('url').notNull(),
  mimeType: varchar('mime_type', { length: 100 }),
  sizeBytes: integer('size_bytes'),
  uploadedById: uuid('uploaded_by_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============ Ticket History ============

export const ticketHistory = pgTable('ticket_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id')
    .notNull()
    .references(() => tickets.id, { onDelete: 'cascade' }),
  changeType: ticketChangeTypeEnum('change_type').notNull(),
  field: varchar('field', { length: 100 }),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  changedById: uuid('changed_by_id'),
  changedByType: commentAuthorTypeEnum('changed_by_type').notNull().default('staff'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============ Canned Responses ============

export const cannedResponses = pgTable('canned_responses', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  categoryId: uuid('category_id').references(() => ticketCategories.id, {
    onDelete: 'set null',
  }),
  shortcut: varchar('shortcut', { length: 50 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============ Knowledge Base ============

export const kbCategories = pgTable('kb_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  description: text('description'),
  parentId: uuid('parent_id'),
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const kbArticles = pgTable('kb_articles', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  categoryId: uuid('category_id').references(() => kbCategories.id, {
    onDelete: 'set null',
  }),
  content: text('content').notNull(),
  excerpt: text('excerpt'),
  tags: text('tags').array(),
  status: kbStatusEnum('status').notNull().default('brouillon'),
  authorId: uuid('author_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  viewCount: integer('view_count').notNull().default(0),
  helpfulCount: integer('helpful_count').notNull().default(0),
  notHelpfulCount: integer('not_helpful_count').notNull().default(0),
  version: integer('version').notNull().default(1),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const kbArticleVersions = pgTable('kb_article_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  articleId: uuid('article_id')
    .notNull()
    .references(() => kbArticles.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  changedById: uuid('changed_by_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const faqItems = pgTable('faq_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  categoryId: uuid('category_id').references(() => kbCategories.id, {
    onDelete: 'set null',
  }),
  sortOrder: integer('sort_order').default(0),
  isPublished: boolean('is_published').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============ Chat Messages ============

export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => chatSessions.id, { onDelete: 'cascade' }),
  role: messageRoleEnum('role').notNull(),
  content: text('content'),
  toolName: varchar('tool_name', { length: 100 }),
  toolInput: jsonb('tool_input'),
  toolOutput: jsonb('tool_output'),
  tokenCount: integer('token_count'),
  modelId: varchar('model_id', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============ AI Audit Log ============

export const aiAuditLog = pgTable('ai_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => chatSessions.id, {
    onDelete: 'set null',
  }),
  clientAccountId: uuid('client_account_id').references(
    () => clientAccounts.id,
    { onDelete: 'set null' }
  ),
  toolName: varchar('tool_name', { length: 100 }).notNull(),
  toolInput: jsonb('tool_input'),
  toolOutput: jsonb('tool_output'),
  durationMs: integer('duration_ms'),
  success: boolean('success').notNull().default(true),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============ Type Exports ============

export type ClientAccount = typeof clientAccounts.$inferSelect;
export type NewClientAccount = typeof clientAccounts.$inferInsert;
export type ClientRefreshToken = typeof clientRefreshTokens.$inferSelect;
export type NewClientRefreshToken = typeof clientRefreshTokens.$inferInsert;
export type TicketCategory = typeof ticketCategories.$inferSelect;
export type NewTicketCategory = typeof ticketCategories.$inferInsert;
export type SlaDefinition = typeof slaDefinitions.$inferSelect;
export type NewSlaDefinition = typeof slaDefinitions.$inferInsert;
export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
export type TicketComment = typeof ticketComments.$inferSelect;
export type NewTicketComment = typeof ticketComments.$inferInsert;
export type TicketAttachment = typeof ticketAttachments.$inferSelect;
export type TicketHistory = typeof ticketHistory.$inferSelect;
export type CannedResponse = typeof cannedResponses.$inferSelect;
export type NewCannedResponse = typeof cannedResponses.$inferInsert;
export type KbCategory = typeof kbCategories.$inferSelect;
export type NewKbCategory = typeof kbCategories.$inferInsert;
export type KbArticle = typeof kbArticles.$inferSelect;
export type NewKbArticle = typeof kbArticles.$inferInsert;
export type KbArticleVersion = typeof kbArticleVersions.$inferSelect;
export type FaqItem = typeof faqItems.$inferSelect;
export type NewFaqItem = typeof faqItems.$inferInsert;
export type ChatSession = typeof chatSessions.$inferSelect;
export type NewChatSession = typeof chatSessions.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
export type AiAuditLog = typeof aiAuditLog.$inferSelect;

// ============ Label Maps ============

export const ticketStatusLabels: Record<string, string> = {
  nouveau: 'Nouveau',
  ouvert: 'Ouvert',
  en_attente_client: 'En attente client',
  en_attente_interne: 'En attente interne',
  escalade: 'Escaladé',
  resolu: 'Résolu',
  ferme: 'Fermé',
};

export const ticketPriorityLabels: Record<string, string> = {
  basse: 'Basse',
  normale: 'Normale',
  haute: 'Haute',
  urgente: 'Urgente',
  critique: 'Critique',
};

export const ticketSourceLabels: Record<string, string> = {
  email: 'Email',
  telephone: 'Téléphone',
  portail: 'Portail',
  chat_ai: 'Chat IA',
  backoffice: 'Backoffice',
  api: 'API',
};

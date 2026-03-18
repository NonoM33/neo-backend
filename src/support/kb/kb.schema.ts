import { z } from 'zod';

const kbStatuses = ['brouillon', 'publie', 'archive'] as const;

export const createKbCategorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100),
  description: z.string().optional(),
  parentId: z.string().uuid().optional(),
  sortOrder: z.coerce.number().int().default(0),
});

export const updateKbCategorySchema = createKbCategorySchema.partial();

export const createArticleSchema = z.object({
  title: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  categoryId: z.string().uuid().optional(),
  content: z.string().min(1),
  excerpt: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(kbStatuses).default('brouillon'),
});

export const updateArticleSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(255).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  content: z.string().min(1).optional(),
  excerpt: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(kbStatuses).optional(),
});

export const createFaqSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  categoryId: z.string().uuid().optional(),
  sortOrder: z.coerce.number().int().default(0),
  isPublished: z.boolean().default(false),
});

export const updateFaqSchema = createFaqSchema.partial();

export const articleSearchSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  tag: z.string().optional(),
});

export const articleFeedbackSchema = z.object({
  helpful: z.boolean(),
});

export type CreateKbCategoryInput = z.infer<typeof createKbCategorySchema>;
export type UpdateKbCategoryInput = z.infer<typeof updateKbCategorySchema>;
export type CreateArticleInput = z.infer<typeof createArticleSchema>;
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;
export type CreateFaqInput = z.infer<typeof createFaqSchema>;
export type UpdateFaqInput = z.infer<typeof updateFaqSchema>;

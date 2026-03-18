import { z } from 'zod';

// Create/update sales objective schema
export const salesObjectiveSchema = z.object({
  userId: z.string().uuid(),
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12).optional(),
  quarter: z.coerce.number().int().min(1).max(4).optional(),
  revenueTarget: z.coerce.number().min(0).optional(),
  leadsTarget: z.coerce.number().int().min(0).optional(),
  conversionsTarget: z.coerce.number().int().min(0).optional(),
  activitiesTarget: z.coerce.number().int().min(0).optional(),
});

// KPI filter schema
export const kpiFilterSchema = z.object({
  userId: z.string().uuid().optional(),
  year: z.coerce.number().int().min(2020).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  quarter: z.coerce.number().int().min(1).max(4).optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

// Type exports
export type SalesObjectiveInput = z.infer<typeof salesObjectiveSchema>;
export type KPIFilter = z.infer<typeof kpiFilterSchema>;

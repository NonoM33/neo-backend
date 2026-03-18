import { z } from 'zod';

export const publicAppointmentTypeValues = [
  'visite_technique',
  'audit',
  'rdv_commercial',
] as const;

export const publicSlotsQuerySchema = z.object({
  type: z.enum(publicAppointmentTypeValues),
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
});

export const publicBookingSchema = z.object({
  type: z.enum(publicAppointmentTypeValues),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD requis'),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Format HH:MM requis'),
  // Client info
  firstName: z.string().min(1, 'Pr\u00e9nom requis').max(100),
  lastName: z.string().min(1, 'Nom requis').max(100),
  email: z.string().email('Email invalide'),
  phone: z.string().min(1, 'T\u00e9l\u00e9phone requis').max(20),
  address: z.string().min(1, 'Adresse requise').max(500),
  postalCode: z
    .string()
    .regex(/^[0-9]{5}$/, 'Code postal \u00e0 5 chiffres requis'),
  city: z.string().min(1, 'Ville requise').max(100),
  housingType: z.enum(['appartement', 'maison', 'autre']).optional(),
  needs: z.array(z.string()).optional(),
  message: z.string().max(2000).optional(),
  consent: z
    .boolean()
    .refine((val) => val === true, { message: 'Le consentement est requis' }),
  // Honeypot field - must be empty (bot trap)
  website: z.string().max(0).optional(),
});

export type PublicSlotsQuery = z.infer<typeof publicSlotsQuerySchema>;
export type PublicBookingInput = z.infer<typeof publicBookingSchema>;

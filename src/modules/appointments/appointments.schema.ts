import { z } from 'zod';

// Enum values
export const appointmentTypeValues = [
  'visite_technique',
  'audit',
  'rdv_commercial',
  'installation',
  'sav',
  'reunion_interne',
  'autre',
] as const;

export const appointmentStatusValues = [
  'propose',
  'confirme',
  'en_cours',
  'termine',
  'annule',
  'no_show',
] as const;

export const recurrenceFrequencyValues = [
  'quotidien',
  'hebdomadaire',
  'bi_hebdomadaire',
  'mensuel',
] as const;

export const dayOfWeekValues = [
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
  'dimanche',
] as const;

export const participantRoleValues = [
  'organisateur',
  'participant',
  'optionnel',
] as const;

export const participantStatusValues = [
  'en_attente',
  'accepte',
  'refuse',
] as const;

export const locationTypeValues = [
  'sur_site',
  'bureau',
  'visio',
  'telephone',
] as const;

// Participant sub-schema
const participantSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(participantRoleValues).default('participant'),
});

// Create appointment schema
export const createAppointmentSchema = z.object({
  title: z.string().max(255).optional(),
  type: z.enum(appointmentTypeValues),
  scheduledAt: z.coerce.date(),
  endAt: z.coerce.date(),
  duration: z.coerce.number().int().min(1, 'Durée minimum 1 minute'),
  location: z.string().optional(),
  locationType: z.enum(locationTypeValues).default('sur_site'),
  organizerId: z.string().uuid().optional(), // Defaults to current user
  leadId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  notes: z.string().optional(),
  metadata: z.any().optional(),
  participants: z.array(participantSchema).optional(),
});

// Update appointment schema
export const updateAppointmentSchema = createAppointmentSchema.partial();

// Appointment filter schema
export const appointmentFilterSchema = z.object({
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
  type: z.enum(appointmentTypeValues).optional(),
  status: z.enum(appointmentStatusValues).optional(),
  userId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
});

// Complete appointment schema
export const completeAppointmentSchema = z.object({
  outcome: z.string().optional(),
  actualDuration: z.coerce.number().int().min(1).optional(),
});

// Cancel appointment schema
export const cancelAppointmentSchema = z.object({
  reason: z.string().min(1, 'Raison requise'),
});

// Set availability schema (bulk replace)
export const setAvailabilitySchema = z.object({
  slots: z.array(
    z.object({
      dayOfWeek: z.enum(dayOfWeekValues),
      startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM requis'),
      endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM requis'),
      isActive: z.boolean().default(true),
    })
  ),
});

// Availability override schema
export const availabilityOverrideSchema = z.object({
  date: z.coerce.date(),
  isAvailable: z.boolean(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM requis').optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM requis').optional(),
  reason: z.string().optional(),
});

// Recurrence sub-schema
const recurrenceSchema = z.object({
  frequency: z.enum(recurrenceFrequencyValues),
  interval: z.coerce.number().int().min(1).default(1),
  daysOfWeek: z.array(z.enum(dayOfWeekValues)).optional(),
  endDate: z.coerce.date().optional(),
  maxOccurrences: z.coerce.number().int().min(1).optional(),
});

// Create recurring appointment schema
export const createRecurringSchema = createAppointmentSchema.extend({
  recurrence: recurrenceSchema,
});

// Add participant schema
export const addParticipantSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(participantRoleValues).default('participant'),
});

// Respond to invitation schema
export const respondToInvitationSchema = z.object({
  status: z.enum(['accepte', 'refuse'] as const),
});

// Update type config schema
export const updateTypeConfigSchema = z.object({
  label: z.string().max(100).optional(),
  defaultDuration: z.coerce.number().int().min(1).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Format couleur hex requis').optional(),
  icon: z.string().max(50).optional(),
  allowedRoles: z.array(z.string()).optional(),
  requiresClient: z.boolean().optional(),
  requiresLocation: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

// Available slots query schema
export const availableSlotsQuerySchema = z.object({
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
  duration: z.coerce.number().int().min(1).default(60),
});

// Update audit data schema (deep-merge into metadata.audit)
export const updateAuditSchema = z.object({
  startedAt: z.string().optional(),
  currentSection: z.number().int().min(0).optional(),
  sections: z.record(z.string(), z.object({
    items: z.record(z.string(), z.union([z.boolean(), z.string(), z.number()])).optional(),
    notes: z.string().optional(),
  })).optional(),
});

// Type exports
export type UpdateAuditInput = z.infer<typeof updateAuditSchema>;
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type AppointmentFilter = z.infer<typeof appointmentFilterSchema>;
export type CompleteAppointmentInput = z.infer<typeof completeAppointmentSchema>;
export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;
export type SetAvailabilityInput = z.infer<typeof setAvailabilitySchema>;
export type AvailabilityOverrideInput = z.infer<typeof availabilityOverrideSchema>;
export type CreateRecurringInput = z.infer<typeof createRecurringSchema>;
export type AddParticipantInput = z.infer<typeof addParticipantSchema>;
export type RespondToInvitationInput = z.infer<typeof respondToInvitationSchema>;
export type UpdateTypeConfigInput = z.infer<typeof updateTypeConfigSchema>;
export type AvailableSlotsQuery = z.infer<typeof availableSlotsQuerySchema>;
export type AppointmentType = (typeof appointmentTypeValues)[number];
export type AppointmentStatus = (typeof appointmentStatusValues)[number];
export type RecurrenceFrequency = (typeof recurrenceFrequencyValues)[number];
export type DayOfWeek = (typeof dayOfWeekValues)[number];
export type ParticipantRole = (typeof participantRoleValues)[number];
export type ParticipantStatus = (typeof participantStatusValues)[number];
export type LocationType = (typeof locationTypeValues)[number];

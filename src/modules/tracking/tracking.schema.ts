import { z } from 'zod';

// Start tracking session
export const startTrackingSchema = z.object({
  appointmentId: z.string().uuid(),
  currentLat: z.number().min(-90).max(90),
  currentLng: z.number().min(-180).max(180),
});

// Update location
export const updateLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).optional(),
  heading: z.number().min(0).max(360).optional(),
  speed: z.number().min(0).optional(),
});

// Types
export type StartTrackingInput = z.infer<typeof startTrackingSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;

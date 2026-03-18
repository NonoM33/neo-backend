import type { Context } from 'hono';
import { AppError } from '../lib/errors';
import { env } from '../config/env';

export async function errorHandler(err: Error, c: Context) {
  console.error('Error:', err);

  if (err instanceof AppError) {
    return c.json(
      {
        error: {
          message: err.message,
          code: err.code,
        },
      },
      err.statusCode as any
    );
  }

  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    return c.json(
      {
        error: {
          message: 'Données invalides',
          code: 'VALIDATION_ERROR',
          details: (err as any).errors,
        },
      },
      400
    );
  }

  // Generic error
  return c.json(
    {
      error: {
        message: env.NODE_ENV === 'production' ? 'Erreur interne du serveur' : err.message,
        code: 'INTERNAL_ERROR',
      },
    },
    500
  );
}

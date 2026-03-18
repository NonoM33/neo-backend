import { z } from 'zod';

const envSchema = z.object({
  // Server
  PORT: z.string().default('3000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  DATABASE_URL: z.string().url(),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // S3/MinIO
  S3_ENDPOINT: z.string().url(),
  S3_ACCESS_KEY: z.string(),
  S3_SECRET_KEY: z.string(),
  S3_BUCKET_PHOTOS: z.string().default('neo-photos'),
  S3_BUCKET_DOCUMENTS: z.string().default('neo-documents'),
  S3_REGION: z.string().default('us-east-1'),

  // AI
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default('claude-sonnet-4-20250514'),
  AI_MAX_TOKENS: z.coerce.number().default(2048),
  AI_MONTHLY_BUDGET_CENTS: z.coerce.number().default(50000),

  // Whisper (Speech-to-Text)
  WHISPER_URL: z.string().default('http://localhost:8000'),
  WHISPER_API_KEY: z.string().optional(),

  // Client Auth
  CLIENT_JWT_SECRET: z.string().min(32).optional(),
  CLIENT_JWT_EXPIRES_IN: z.string().default('1h'),
  CLIENT_JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // Support S3
  S3_BUCKET_SUPPORT: z.string().default('neo-support'),

  // SMS Gateway
  SMS_API_URL: z.string().default('https://api.sms-gate.app/3rdparty/v1/messages'),
  SMS_API_USER: z.string().default('EZMOAP'),
  SMS_API_PASSWORD: z.string().default('mx3yvylh7y-8-o'),
  SMS_ENABLED: z.string().default('true'),

  // Admin
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(6).optional(),

  // Tracking
  TRACKING_EXPIRY_HOURS: z.coerce.number().default(4),
  PUBLIC_URL: z.string().default('http://localhost:3000'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Invalid environment variables:');
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
}

export const env = loadEnv();

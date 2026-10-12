import { z } from 'zod';
import { DEFAULT_TIMEZONE } from '@gastos/shared';

/**
 * The only file that reads process.env. Everything else imports `env`.
 * The process refuses to start when a variable is missing or malformed.
 */

try {
  process.loadEnvFile();
} catch {
  // No .env file: in production the variables come from the host.
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_DAYS: z.coerce.number().int().positive().default(30),
  AUTH_USERNAME: z.string().min(1),
  AUTH_PASSWORD_HASH: z.string().regex(/^\$2[aby]\$/, 'AUTH_PASSWORD_HASH must be a bcrypt hash'),
  CORS_ORIGIN: z
    .string()
    .min(1)
    .transform((value) => value.split(',').map((origin) => origin.trim().replace(/\/$/, ''))),
  APP_TIMEZONE: z.string().default(DEFAULT_TIMEZONE),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** Empty means AI reading is off: uploads are refused with a clear message. */
  GEMINI_API_KEY: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined),
  GEMINI_MODEL: z.string().min(1).default('gemini-3.5-flash-lite'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `  ${issue.path.join('.')}: ${issue.message}`);
    console.error(`Invalid environment configuration:\n${problems.join('\n')}`);
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();

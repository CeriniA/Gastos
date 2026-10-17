import { z } from 'zod';
import { DEFAULT_AI_DAILY_READINGS, DEFAULT_TIMEZONE, SESSION_DAYS } from '@gastos/shared';

/**
 * The only file that reads process.env. Everything else imports `env`.
 * The process refuses to start when a variable is missing or malformed.
 */

try {
  process.loadEnvFile();
} catch {
  // No .env file: in production the variables come from the host.
}

/** Defaults for local development; Render sets its own port. */
const DEFAULT_PORT = 4000;
/** A shorter secret can be guessed; this is what HS256 tokens need. */
const MIN_JWT_SECRET_LENGTH = 32;

/** An optional secret: missing or blank means the feature that needs it is off. */
const optionalSecret = z
  .string()
  .optional()
  .transform((value) => value?.trim() || undefined);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(DEFAULT_PORT),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z
    .string()
    .min(MIN_JWT_SECRET_LENGTH, `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters`),
  JWT_EXPIRES_DAYS: z.coerce.number().int().positive().default(SESSION_DAYS),
  /**
   * The first user, an admin, created when the server starts and nobody
   * exists yet. After that, users and passwords are managed from the app and
   * these two are no longer read.
   */
  AUTH_USERNAME: z.string().min(1),
  AUTH_PASSWORD_HASH: z.string().regex(/^\$2[aby]\$/, 'AUTH_PASSWORD_HASH must be a bcrypt hash'),
  CORS_ORIGIN: z
    .string()
    .min(1)
    .transform((value) => value.split(',').map((origin) => origin.trim().replace(/\/$/, ''))),
  APP_TIMEZONE: z.string().default(DEFAULT_TIMEZONE),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** Empty means AI reading is off: uploads are refused with a clear message. */
  GEMINI_API_KEY: optionalSecret,
  GEMINI_MODEL: z.string().min(1).default('gemini-3.5-flash-lite'),
  /** Documents each user can send to the AI per day; the admin can give someone another limit. */
  AI_DAILY_READINGS: z.coerce.number().int().min(0).default(DEFAULT_AI_DAILY_READINGS),
  /**
   * The automatic copy to Google Drive. The OAuth client comes from Google
   * Cloud and is the app's; each user then connects their own Drive from the
   * app. All three, or nobody can. See docs/RESPALDO_DRIVE.md.
   */
  DRIVE_CLIENT_ID: optionalSecret,
  DRIVE_CLIENT_SECRET: optionalSecret,
  /** This server's own public address, where Google sends users back. No trailing slash. */
  PUBLIC_API_URL: z
    .string()
    .optional()
    .transform((value) => value?.trim().replace(/\/$/, '') || undefined),
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

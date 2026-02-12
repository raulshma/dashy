/**
 * Server-side environment configuration with typed parsing and validation.
 *
 * This module provides a singleton configuration object that validates all
 * required environment variables at startup. Missing or invalid values will
 * throw descriptive errors to catch deployment misconfigurations early.
 *
 * Usage:
 *   import { config } from '@server/config'
 *   const dbPath = config.database.path
 */
import { z } from 'zod'

/**
 * Schema defining all server environment variables.
 * Values are parsed and validated at module load time.
 */
const envSchema = z.object({
  // ─── General ──────────────────────────────
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // ─── Database ─────────────────────────────
  DATABASE_PATH: z.string().default('./data/dashy.db'),

  // ─── Auth / Session ───────────────────────
  SESSION_SECRET: z
    .string()
    .min(32, 'SESSION_SECRET must be at least 32 characters')
    .default('change-me-to-a-random-secret-at-least-32-chars!!'),
  SESSION_MAX_AGE_DAYS: z.coerce.number().int().min(1).default(7),

  // ─── CORS ─────────────────────────────────
  CORS_ORIGIN: z.string().default('*'),

  // ─── External APIs (optional, used by widgets) ─
  OPENWEATHER_API_KEY: z.string().optional(),

  // ─── Rate Limiting ───────────────────────────
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().min(1).default(5),
  RATE_LIMIT_AUTH_STRICT_MAX: z.coerce.number().int().min(1).default(3),
  RATE_LIMIT_API_MAX: z.coerce.number().int().min(1).default(100),
  RATE_LIMIT_API_WRITE_MAX: z.coerce.number().int().min(1).default(50),
  RATE_LIMIT_PUBLIC_MAX: z.coerce.number().int().min(1).default(60),
})

/**
 * Inferred type of the validated environment configuration.
 */
export type EnvConfig = z.infer<typeof envSchema>

/**
 * Parse and validate environment variables.
 * Throws a descriptive error listing all missing/invalid values.
 */
function loadConfig(): EnvConfig {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')

    throw new Error(
      `❌ Environment configuration error:\n${formatted}\n\nSee .env.example for required variables.`,
    )
  }

  return result.data
}

/**
 * Derived configuration object with semantically grouped settings.
 */
export interface AppConfig {
  /** Whether we're running in development mode */
  isDev: boolean
  /** Whether we're running in production mode */
  isProd: boolean
  /** Whether we're running in test mode */
  isTest: boolean
  /** General application settings */
  app: {
    port: number
    logLevel: 'debug' | 'info' | 'warn' | 'error'
    corsOrigin: string
  }
  /** Database connection settings */
  database: {
    path: string
  }
  /** Session / authentication settings */
  session: {
    secret: string
    maxAgeDays: number
    maxAgeMs: number
  }
  /** External API keys (optional) */
  externalApis: {
    openWeatherApiKey?: string
  }
  /** Rate limiting settings */
  rateLimit: {
    authMax: number
    authStrictMax: number
    apiMax: number
    apiWriteMax: number
    publicMax: number
  }
}

/**
 * Transform raw env values into a semantically structured config object.
 */
function buildConfig(env: EnvConfig): AppConfig {
  return {
    isDev: env.NODE_ENV === 'development',
    isProd: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
    app: {
      port: env.PORT,
      logLevel: env.LOG_LEVEL,
      corsOrigin: env.CORS_ORIGIN,
    },
    database: {
      path: env.DATABASE_PATH,
    },
    session: {
      secret: env.SESSION_SECRET,
      maxAgeDays: env.SESSION_MAX_AGE_DAYS,
      maxAgeMs: env.SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
    },
    externalApis: {
      openWeatherApiKey: env.OPENWEATHER_API_KEY,
    },
    rateLimit: {
      authMax: env.RATE_LIMIT_AUTH_MAX,
      authStrictMax: env.RATE_LIMIT_AUTH_STRICT_MAX,
      apiMax: env.RATE_LIMIT_API_MAX,
      apiWriteMax: env.RATE_LIMIT_API_WRITE_MAX,
      publicMax: env.RATE_LIMIT_PUBLIC_MAX,
    },
  }
}

/**
 * The validated, typed application configuration.
 * Singleton — loaded once at module initialization.
 */
export const config: AppConfig = buildConfig(loadConfig())

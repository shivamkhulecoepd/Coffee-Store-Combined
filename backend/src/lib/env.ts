import { z } from 'zod';

// Environment validation schema
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('4000'),
  API_PREFIX: z.string().default('/api/v1'),

  // Database
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/bean_brew'),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379'),
  REDIS_PASSWORD: z.string().optional(),

  // JWT
  JWT_ACCESS_SECRET: z.string().default('dev-access-secret-min-32-chars-for-development'),
  JWT_REFRESH_SECRET: z.string().default('dev-refresh-secret-min-32-chars-for-development'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Argon2
  ARGON2_SALT_LENGTH: z.string().default('16'),
  ARGON2_TIME_COST: z.string().default('3'),
  ARGON2_MEMORY_COST: z.string().default('65536'),
  ARGON2_PARALLELISM: z.string().default('4'),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // OTP
  OTP_EXPIRES_IN_MINUTES: z.string().default('10'),
  OTP_LENGTH: z.string().default('6'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100'),

  // Logging
  LOG_LEVEL: z.string().default('info'),
  LOG_DIR: z.string().default('./logs'),

  // S3 (optional)
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

let cachedConfig: EnvConfig | null = null;

export function validateEnvironment(): EnvConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const validated = envSchema.parse(process.env);
  cachedConfig = validated;
  return validated;
}

export function getEnv(): EnvConfig {
  if (!cachedConfig) {
    return validateEnvironment();
  }
  return cachedConfig;
}

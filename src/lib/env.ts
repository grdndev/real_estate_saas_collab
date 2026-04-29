import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    DATABASE_URL: z.string().url(),

    AUTH_SECRET: z
      .string()
      .min(32, "AUTH_SECRET trop court (>= 32 caractères)"),
    AUTH_TRUST_HOST: z
      .string()
      .optional()
      .transform((v) => v === "true"),

    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
    REFRESH_TOKEN_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(604800),
    SESSION_INACTIVITY_MINUTES: z.coerce.number().int().positive().default(30),
    LOGIN_LOCK_MINUTES: z.coerce.number().int().positive().default(15),
    LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),

    DATA_ENCRYPTION_KEY: z
      .string()
      .regex(
        /^[0-9a-f]{64}$/i,
        "DATA_ENCRYPTION_KEY doit être 64 hex chars (32 bytes)",
      ),

    S3_ENDPOINT: z.string().url().optional(),
    S3_REGION: z.string().optional(),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),

    CLAMAV_HOST: z.string().optional(),
    CLAMAV_PORT: z.coerce.number().int().optional(),

    YOUSIGN_API_KEY: z.string().optional(),
    YOUSIGN_API_URL: z.string().url().optional(),
    YOUSIGN_WEBHOOK_SECRET: z.string().optional(),

    BREVO_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().email().optional(),
    EMAIL_FROM_NAME: z.string().optional(),

    SENTRY_DSN: z.string().url().optional().or(z.literal("")),
    SENTRY_ENVIRONMENT: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  emptyStringAsUndefined: true,
  skipValidation: process.env.SKIP_ENV_VALIDATION === "1",
});

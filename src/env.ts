import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  /**
   * Server-side environment variables schema.
   * These are NOT exposed to the client bundle.
   */
  server: {
    // Database
    DATABASE_URL: z.string().url().startsWith('postgresql://'),

    // Clerk Auth
    CLERK_SECRET_KEY: z.string().min(1),

    // Stripe
    STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
    STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),

    // Cloudflare R2
    R2_ACCOUNT_ID: z.string().min(1),
    R2_ACCESS_KEY_ID: z.string().min(1),
    R2_SECRET_ACCESS_KEY: z.string().min(1),
    R2_BUCKET_NAME: z.string().min(1),
    R2_PUBLIC_URL: z.string().url(),

    // Upstash Redis
    UPSTASH_REDIS_REST_URL: z.string().url(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

    // Upstash QStash
    QSTASH_URL: z.string().url().optional(),
    QSTASH_TOKEN: z.string().min(1).optional(),
    QSTASH_CURRENT_SIGNING_KEY: z.string().min(1).optional(),
    QSTASH_NEXT_SIGNING_KEY: z.string().min(1).optional(),

    // 3D API Providers
    TRIPO_API_KEY: z.string().min(1),
    RODIN_API_KEY: z.string().min(1).optional(),
    MESHY_API_KEY: z.string().min(1).optional(),

    // Internal
    INTERNAL_API_SECRET: z.string().min(16),

    // Compression Worker
    COMPRESSION_LAMBDA_URL: z.string().url().optional(),

    // Node environment
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  },

  /**
   * Client-side environment variables schema.
   * Must be prefixed with NEXT_PUBLIC_ to be exposed to the browser.
   */
  client: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().default('/sign-in'),
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().default('/sign-up'),
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: z.string().default('/dashboard'),
    NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: z.string().default('/dashboard'),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
    NEXT_PUBLIC_APP_URL: z.string().url(),
  },

  /**
   * Runtime values — maps env vars for both server and client.
   * In Next.js, client vars MUST be destructured explicitly.
   */
  runtimeEnv: {
    // Server
    DATABASE_URL: process.env.DATABASE_URL,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
    R2_PUBLIC_URL: process.env.R2_PUBLIC_URL,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    QSTASH_URL: process.env.QSTASH_URL,
    QSTASH_TOKEN: process.env.QSTASH_TOKEN,
    QSTASH_CURRENT_SIGNING_KEY: process.env.QSTASH_CURRENT_SIGNING_KEY,
    QSTASH_NEXT_SIGNING_KEY: process.env.QSTASH_NEXT_SIGNING_KEY,
    TRIPO_API_KEY: process.env.TRIPO_API_KEY,
    RODIN_API_KEY: process.env.RODIN_API_KEY,
    MESHY_API_KEY: process.env.MESHY_API_KEY,
    INTERNAL_API_SECRET: process.env.INTERNAL_API_SECRET,
    COMPRESSION_LAMBDA_URL: process.env.COMPRESSION_LAMBDA_URL,
    NODE_ENV: process.env.NODE_ENV,

    // Client
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL,
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL,
    NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },

  /**
   * Skip validation during build if env vars are not yet available
   * (e.g., in CI/CD pipelines that only run `next build` for static analysis).
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,

  /**
   * Throw if a server-side env var is accidentally accessed on the client.
   */
  emptyStringAsUndefined: true,
});

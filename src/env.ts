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

    // Cloudflare R2
    R2_ACCOUNT_ID: z.string().min(1),
    R2_ACCESS_KEY_ID: z.string().min(1),
    R2_SECRET_ACCESS_KEY: z.string().min(1),
    R2_BUCKET_NAME: z.string().min(1),
    R2_PUBLIC_URL: z.string().url(),

    // fal.ai (server-side only)
    FAL_KEY: z.string().min(1),

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
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: z.string().default('/'),
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
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
    R2_PUBLIC_URL: process.env.R2_PUBLIC_URL,
    FAL_KEY: process.env.FAL_KEY,
    NODE_ENV: process.env.NODE_ENV,

    // Client
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL,
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

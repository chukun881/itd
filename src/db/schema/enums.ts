import { pgEnum } from 'drizzle-orm/pg-core';

export const tierEnum = pgEnum('tier', ['standard', 'premium']);

export const jobStatusEnum = pgEnum('job_status', [
  'pending',       // Job created, awaiting image upload confirmation
  'uploading',     // Image is being uploaded to R2
  'queued',        // Enqueued in Upstash, waiting for provider slot
  'submitted',     // Submitted to 3D API provider
  'processing',    // Provider is generating the 3D model
  'compressing',   // Raw model downloaded, compression pipeline running
  'completed',     // Compressed model ready for download
  'failed',        // Generation or compression failed
  'refunded',      // Credits refunded after failure
]);

export const providerEnum = pgEnum('provider', ['tripo', 'rodin', 'meshy', 'fal']);

export const creditTransactionTypeEnum = pgEnum('credit_transaction_type', [
  'purchase',      // User bought credits via Stripe
  'generation',    // Credits deducted for a generation job
  'refund',        // Credits refunded after a failed generation
  'bonus',         // Admin-granted bonus credits
]);

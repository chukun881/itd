import { pgEnum } from 'drizzle-orm/pg-core';

// Only pending, submitted, processing, completed and failed are used by the MVP.
// The other values stay because removing Postgres enum values needs a type rebuild.
export const jobStatusEnum = pgEnum('job_status', [
  'pending',       // Job created, waiting for the photo uploads
  'uploading',
  'queued',
  'submitted',     // Sent to fal, waiting for the webhook
  'processing',    // Webhook received, post-processing the mesh
  'compressing',
  'completed',     // Files ready to download
  'failed',
  'refunded',
]);

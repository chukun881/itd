import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '@/env';

/**
 * Cloudflare R2 client using the S3-compatible API.
 * R2 uses the S3 protocol but with zero egress fees.
 */
export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = env.R2_BUCKET_NAME;

/**
 * Every file of a job lives under jobs/{jobId}/:
 *   input-{view}.{ext}, cutout-{view}.png, raw.glb,
 *   model.glb, model.stl, model.obj, preview.png, model.step
 */
export function jobKey(jobId: string, file: string): string {
  return `jobs/${jobId}/${file}`;
}

/**
 * Generate a presigned PUT URL for direct browser-to-R2 uploads.
 * The serverless function never touches the binary data.
 *
 * @param key - Full R2 object key (e.g., "raw-uploads/abc-123.jpg")
 * @param contentType - MIME type restriction
 * @param expiresIn - URL expiry in seconds (default: 5 minutes)
 */
export async function getPresignedPutUrl(
  key: string,
  contentType: string,
  expiresIn: number = 300, // 5 minutes
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(r2Client, command, { expiresIn });
}

/**
 * Generate a presigned GET URL for authenticated model downloads.
 *
 * @param key - Full R2 object key
 * @param expiresIn - URL expiry in seconds (default: 1 hour)
 * @param downloadName - If set, the browser downloads the file with this name
 */
export async function getPresignedGetUrl(
  key: string,
  expiresIn: number = 3600, // 1 hour
  downloadName?: string,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ResponseContentDisposition: downloadName ? `attachment; filename="${downloadName}"` : undefined,
  });

  return getSignedUrl(r2Client, command, { expiresIn });
}

/**
 * Upload a buffer directly to R2 (server-side only — used by webhook handler).
 */
export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string = 'model/gltf-binary',
): Promise<void> {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'private, max-age=31536000, immutable',
    }),
  );
}

/**
 * Delete an object from R2 (cleanup on failure or expiry).
 */
export async function deleteFromR2(key: string): Promise<void> {
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }),
  );
}

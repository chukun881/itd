import { createFalClient } from '@fal-ai/client';
import type { JobView } from '@/db/schema';
import { env } from '@/env';

/** fal endpoints and prices (fal model pages, checked 2026-11-05). */
export const FAL = {
  backgroundEndpoint: 'fal-ai/bria/background/remove',
  modelEndpoint: 'fal-ai/hunyuan-3d/v3.1/pro/image-to-3d',
  priceBackgroundUsd: 0.018,
  priceModelUsd: 0.375,
  priceMultiViewUsd: 0.15,
} as const;

export function estimateCostUsd(viewCount: number, removeBackground: boolean): number {
  const model = FAL.priceModelUsd + (viewCount > 1 ? FAL.priceMultiViewUsd : 0);
  const background = removeBackground ? FAL.priceBackgroundUsd * viewCount : 0;
  return Math.round((model + background) * 1000) / 1000;
}

function client() {
  return createFalClient({ credentials: env.FAL_KEY });
}

/** Remove the background of one photo; returns the URL of the cut-out PNG on fal. */
export async function removeBackground(imageUrl: string): Promise<string> {
  const result = await client().subscribe(FAL.backgroundEndpoint, { input: { image_url: imageUrl } });
  const url = (result.data as { image?: { url?: string } }).image?.url;
  if (!url) throw new Error('Background removal returned no image');
  return url;
}

/**
 * Queue Hunyuan 3D Pro in geometry mode. Submit once only: a second submit is a
 * new billable job. fal calls `webhookUrl` when it finishes.
 */
export async function submitModel(viewUrls: Partial<Record<JobView, string>>, webhookUrl: string): Promise<string> {
  if (!viewUrls.front) throw new Error('A front photo is required');
  const input = {
    input_image_url: viewUrls.front,
    generate_type: 'Geometry' as const,
    ...(viewUrls.back ? { back_image_url: viewUrls.back } : {}),
    ...(viewUrls.left ? { left_image_url: viewUrls.left } : {}),
    ...(viewUrls.right ? { right_image_url: viewUrls.right } : {}),
  };
  const { request_id } = await client().queue.submit(FAL.modelEndpoint, { input, webhookUrl });
  return request_id;
}

export interface FalModelOutput {
  model_glb?: { url: string };
  thumbnail?: { url: string };
}

/** Fetch a finished result from the queue (used when the webhook carries no payload). */
export async function getModelResult(requestId: string): Promise<FalModelOutput> {
  const result = await client().queue.result(FAL.modelEndpoint, { requestId });
  return result.data as FalModelOutput;
}

/** Only download files from fal's own media hosts. */
export function isFalMediaUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === 'https:' && (hostname === 'fal.media' || hostname.endsWith('.fal.media'));
  } catch {
    return false;
  }
}

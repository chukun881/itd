import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { env } from '@/env';

/**
 * Singleton Upstash Redis client for caching, pub/sub, and semaphores.
 */
export const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

/**
 * Rate limiter for the /api/generate endpoint.
 * Sliding window: 5 requests per 60 seconds per user.
 */
export const generateRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '60 s'),
  analytics: true,
  prefix: 'ratelimit:generate',
});

/**
 * Rate limiter for the /api/upload endpoint.
 * Sliding window: 10 requests per 60 seconds per user.
 */
export const uploadRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '60 s'),
  analytics: true,
  prefix: 'ratelimit:upload',
});

/**
 * Provider concurrency caps — reserve headroom below actual API limits.
 * Tripo v3.1: 10 max → we use 8
 * Tripo P1.0: 5 max → we use 4
 * Rodin: 120 RPM → we use 10 concurrent
 */
const PROVIDER_LIMITS: Record<string, number> = {
  tripo: 8,
  rodin: 10,
  meshy: 8,
};

/**
 * Distributed semaphore: acquire a provider slot.
 * Returns true if a slot was acquired, false if at capacity.
 */
export async function acquireProviderSlot(provider: string): Promise<boolean> {
  const key = `semaphore:${provider}`;
  const limit = PROVIDER_LIMITS[provider] ?? 5;

  const current = await redis.incr(key);
  if (current > limit) {
    await redis.decr(key);
    return false;
  }

  // TTL safety net: auto-release if webhook never fires (5 minutes)
  await redis.expire(key, 300);
  return true;
}

/**
 * Release a provider slot after job completion or failure.
 */
export async function releaseProviderSlot(provider: string): Promise<void> {
  const key = `semaphore:${provider}`;
  const current = await redis.decr(key);

  // Prevent underflow (shouldn't happen, but defensive)
  if (current < 0) {
    await redis.set(key, 0);
  }
}

/**
 * Check webhook idempotency — returns true if this delivery was already processed.
 */
export async function isWebhookProcessed(deliveryId: string): Promise<boolean> {
  const result = await redis.set(`webhook:${deliveryId}`, '1', {
    nx: true,
    ex: 86400, // 24-hour TTL
  });

  // Returns null if key already existed (already processed)
  return result === null;
}

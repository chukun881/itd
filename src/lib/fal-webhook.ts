import crypto from 'node:crypto';

/**
 * Verify a fal webhook (https://fal.ai/docs/model-apis/model-endpoints/webhooks):
 * ED25519 signature over
 *   request-id \n user-id \n timestamp \n sha256-hex(raw body)
 * checked against the public keys in fal's JWKS. Timestamp must be within 5 minutes.
 */
export const FAL_JWKS_URL = 'https://rest.fal.ai/.well-known/jwks.json';
const JWKS_TTL_MS = 12 * 60 * 60 * 1000; // fal: do not cache longer than 24 hours
const MAX_SKEW_SECONDS = 300;

interface Jwk {
  kty?: string;
  crv?: string;
  x: string;
}

let cache: { keys: Jwk[]; fetchedAt: number } | null = null;

export async function getFalJwks(fetchImpl: typeof fetch = fetch): Promise<Jwk[]> {
  if (cache && Date.now() - cache.fetchedAt < JWKS_TTL_MS) return cache.keys;
  const res = await fetchImpl(FAL_JWKS_URL);
  if (!res.ok) throw new Error(`fal JWKS fetch failed: ${res.status}`);
  const keys = ((await res.json()) as { keys?: Jwk[] }).keys ?? [];
  cache = { keys, fetchedAt: Date.now() };
  return keys;
}

export function resetFalJwksCache(): void {
  cache = null;
}

export interface FalWebhookHeaders {
  requestId: string | null;
  userId: string | null;
  timestamp: string | null;
  signature: string | null;
}

export function readFalWebhookHeaders(headers: Headers): FalWebhookHeaders {
  return {
    requestId: headers.get('x-fal-webhook-request-id'),
    userId: headers.get('x-fal-webhook-user-id'),
    timestamp: headers.get('x-fal-webhook-timestamp'),
    signature: headers.get('x-fal-webhook-signature'),
  };
}

export async function verifyFalWebhook(
  h: FalWebhookHeaders,
  rawBody: Uint8Array,
  options: { jwks?: Jwk[]; nowSeconds?: number } = {},
): Promise<boolean> {
  if (!h.requestId || !h.userId || !h.timestamp || !h.signature) return false;

  const ts = Number(h.timestamp);
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (!Number.isInteger(ts) || Math.abs(now - ts) > MAX_SKEW_SECONDS) return false;
  if (!/^[0-9a-f]+$/i.test(h.signature)) return false;

  const bodyHash = crypto.createHash('sha256').update(rawBody).digest('hex');
  const message = Buffer.from([h.requestId, h.userId, h.timestamp, bodyHash].join('\n'), 'utf-8');
  const signature = Buffer.from(h.signature, 'hex');

  const keys = options.jwks ?? (await getFalJwks());
  for (const jwk of keys) {
    try {
      const key = crypto.createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: jwk.x.replace(/=+$/, '') }, format: 'jwk' });
      if (crypto.verify(null, message, key, signature)) return true;
    } catch {
      // Malformed key or signature: try the next key.
    }
  }
  return false;
}

import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyFalWebhook } from './fal-webhook';

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
// fal publishes padded base64url keys; make sure padding is accepted.
const jwks = [{ x: `${publicKey.export({ format: 'jwk' }).x as string}=` }];
const NOW = 1_800_000_000;

function sign(body: string, overrides: Partial<Record<string, string>> = {}) {
  const h = { requestId: 'req-1', userId: 'user-1', timestamp: String(NOW), ...overrides };
  const hash = crypto.createHash('sha256').update(body).digest('hex');
  const message = [h.requestId, h.userId, h.timestamp, hash].join('\n');
  const signature = crypto.sign(null, Buffer.from(message), privateKey).toString('hex');
  return { ...h, signature };
}

const body = JSON.stringify({ request_id: 'req-1', status: 'OK', payload: {} });
const bytes = new TextEncoder().encode(body);

describe('verifyFalWebhook', () => {
  it('accepts a correctly signed delivery', async () => {
    expect(await verifyFalWebhook(sign(body), bytes, { jwks, nowSeconds: NOW })).toBe(true);
  });

  it('rejects a changed body', async () => {
    const tampered = new TextEncoder().encode(body.replace('OK', 'ERROR'));
    expect(await verifyFalWebhook(sign(body), tampered, { jwks, nowSeconds: NOW })).toBe(false);
  });

  it('rejects missing headers', async () => {
    const h = { ...sign(body), signature: null };
    expect(await verifyFalWebhook(h, bytes, { jwks, nowSeconds: NOW })).toBe(false);
  });

  it('rejects an old timestamp (replay)', async () => {
    expect(await verifyFalWebhook(sign(body), bytes, { jwks, nowSeconds: NOW + 301 })).toBe(false);
  });

  it('rejects a signature from another key', async () => {
    const other = crypto.generateKeyPairSync('ed25519').publicKey.export({ format: 'jwk' }).x as string;
    expect(await verifyFalWebhook(sign(body), bytes, { jwks: [{ x: other }], nowSeconds: NOW })).toBe(false);
  });

  it('rejects a non-hex or wrong-length signature without throwing', async () => {
    expect(await verifyFalWebhook({ ...sign(body), signature: 'zz' }, bytes, { jwks, nowSeconds: NOW })).toBe(false);
    expect(await verifyFalWebhook({ ...sign(body), signature: 'abcd' }, bytes, { jwks, nowSeconds: NOW })).toBe(false);
  });
});

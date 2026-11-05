// Signed session cookie. Web Crypto only, so it runs in the middleware (Edge) and in Node.
// Value: userId.sessionVersion.expiresUnix.signature. The middleware checks signature and
// expiry; getViewer() also checks sessionVersion against the database, so bumping a
// user's session_version signs them out everywhere.

export const SESSION_COOKIE = 'session';
export const SESSION_DAYS = 30;

export interface SessionPayload {
  userId: string;
  version: number;
  expires: number; // unix seconds
}

const encoder = new TextEncoder();

function base64url(bytes: ArrayBuffer): string {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sign(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64url(await crypto.subtle.sign('HMAC', key, encoder.encode(data)));
}

function equal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(userId: string, version: number, secret: string, now = Date.now()): Promise<string> {
  const expires = Math.floor(now / 1000) + SESSION_DAYS * 86400;
  const data = `${userId}.${version}.${expires}`;
  return `${data}.${await sign(data, secret)}`;
}

export async function readSessionToken(token: string | undefined, secret: string, now = Date.now()): Promise<SessionPayload | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [userId, version, expires, signature] = parts;
  if (!equal(signature, await sign(`${userId}.${version}.${expires}`, secret))) return null;
  if (Number(expires) * 1000 <= now) return null;
  return { userId, version: Number(version), expires: Number(expires) };
}

import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';
import { createSessionToken, readSessionToken } from './session';
import { hashPassword as scriptHash } from '../../../scripts/create-user.mjs';

const SECRET = 'x'.repeat(48);
const USER = '6f1c2b0e-8d2a-4c7e-9a51-2f0b7d3c9e10';

describe('password', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('correct horse');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('correct horse', hash)).toBe(true);
    expect(await verifyPassword('wrong horse', hash)).toBe(false);
  });

  it('accepts hashes written by scripts/create-user.mjs', async () => {
    expect(await verifyPassword('from the script', await scriptHash('from the script'))).toBe(true);
  });

  it('rejects malformed hashes', async () => {
    expect(await verifyPassword('a', 'bcrypt$whatever')).toBe(false);
    expect(await verifyPassword('a', '')).toBe(false);
  });
});

describe('session token', () => {
  it('round-trips user id and version', async () => {
    const token = await createSessionToken(USER, 3, SECRET);
    expect(await readSessionToken(token, SECRET)).toMatchObject({ userId: USER, version: 3 });
  });

  it('rejects a tampered token, a wrong secret and an expired token', async () => {
    const token = await createSessionToken(USER, 1, SECRET);
    const [, version, expires, sig] = token.split('.');
    const otherUser = USER.replace('6f', '7f');
    expect(await readSessionToken(`${otherUser}.${version}.${expires}.${sig}`, SECRET)).toBeNull();
    expect(await readSessionToken(`${USER}.2.${expires}.${sig}`, SECRET)).toBeNull();
    expect(await readSessionToken(token, 'y'.repeat(48))).toBeNull();
    expect(await readSessionToken(token, SECRET, Date.now() + 31 * 86400_000)).toBeNull();
    expect(await readSessionToken(undefined, SECRET)).toBeNull();
    expect(await readSessionToken('garbage', SECRET)).toBeNull();
  });
});

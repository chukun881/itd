#!/usr/bin/env node
// Create a user, or reset their password (which also signs them out everywhere).
//
//   node --env-file=.env.local scripts/create-user.mjs sister@example.com --name "Sister"
//   node --env-file=.env.local scripts/create-user.mjs sister@example.com --reset
//
// Without --password a random one is generated and printed once. Give it to the
// user in person or by a private message. Admins are set with ADMIN_EMAILS.
// The hash format must match src/lib/auth/password.ts.

import { randomBytes, scrypt } from 'node:crypto';
import { parseArgs } from 'node:util';
import { neon } from '@neondatabase/serverless';

const N = 16384, R = 8, P = 1, KEY_LEN = 64;

export function hashPassword(password) {
  const salt = randomBytes(16);
  return new Promise((resolve, reject) =>
    scrypt(password.normalize('NFKC'), salt, KEY_LEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(`scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`),
    ),
  );
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { name: { type: 'string' }, password: { type: 'string' }, reset: { type: 'boolean', default: false } },
  });
  const email = positionals[0]?.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    console.error('Usage: node --env-file=.env.local scripts/create-user.mjs <email> [--name "Name"] [--password "..."] [--reset]');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set (use --env-file=.env.local)');
    process.exit(1);
  }
  const password = values.password ?? randomBytes(12).toString('base64url');
  if (password.length < 10) {
    console.error('Use a password of at least 10 characters');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  const hash = await hashPassword(password);
  const rows = values.reset
    ? await sql`UPDATE users SET password_hash = ${hash}, session_version = session_version + 1,
        failed_logins = 0, locked_until = NULL, updated_at = now() WHERE email = ${email} RETURNING id`
    : await sql`INSERT INTO users (email, name, password_hash) VALUES (${email}, ${values.name ?? null}, ${hash})
        ON CONFLICT (email) DO NOTHING RETURNING id`;

  if (!rows.length) {
    console.error(values.reset ? `No user with email ${email}` : `${email} already exists (use --reset to change the password)`);
    process.exit(1);
  }
  console.log(`${values.reset ? 'Password reset' : 'Created'}: ${email}`);
  if (!values.password) console.log(`Password: ${password}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

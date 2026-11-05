'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { env } from '@/env';
import { hashPassword, verifyPassword } from './password';
import { SESSION_COOKIE, SESSION_DAYS, createSessionToken } from './session';

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
const GENERIC_ERROR = 'Wrong email or password';

let dummy: Promise<string> | undefined;
const dummyHash = () => (dummy ??= hashPassword('dummy-password'));

export interface SignInState {
  error?: string;
}

export async function signIn(_prev: SignInState, form: FormData): Promise<SignInState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  if (!email || !password || password.length > 200) return { error: GENERIC_ERROR };

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    // Same work as a real check, so response time does not reveal which emails exist.
    await verifyPassword(password, await dummyHash());
    return { error: GENERIC_ERROR };
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) return { error: GENERIC_ERROR };

  if (!(await verifyPassword(password, user.passwordHash))) {
    const failed = user.failedLogins + 1;
    await db
      .update(users)
      .set(failed >= MAX_FAILED
        ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) }
        : { failedLogins: failed })
      .where(eq(users.id, user.id));
    return { error: GENERIC_ERROR };
  }

  await db.update(users).set({ failedLogins: 0, lockedUntil: null }).where(eq(users.id, user.id));
  (await cookies()).set(SESSION_COOKIE, await createSessionToken(user.id, user.sessionVersion, env.SESSION_SECRET), {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 86400,
  });
  redirect('/jobs');
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/sign-in');
}

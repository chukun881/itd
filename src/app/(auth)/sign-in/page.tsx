'use client';

import { useActionState } from 'react';
import { signIn, type SignInState } from '@/lib/auth/actions';

export default function SignInPage() {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, {});
  const input = 'w-full rounded border border-neutral-300 px-3 py-2 text-sm';
  return (
    <form action={action} className="w-full max-w-sm space-y-4 rounded-lg border border-neutral-200 bg-white p-6">
      <h1 className="text-lg font-semibold">Furniture 3D Draft</h1>
      <p className="text-sm text-neutral-500">Invite only. Ask the admin for an account.</p>
      <input name="email" type="email" required autoComplete="email" placeholder="Email" className={input} />
      <input name="password" type="password" required autoComplete="current-password" placeholder="Password" className={input} />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="w-full rounded bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700 disabled:opacity-50">
        {pending ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  );
}

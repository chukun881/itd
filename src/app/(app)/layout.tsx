import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signOut } from '@/lib/auth/actions';
import { getViewer } from '@/lib/jobs';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect('/sign-in');

  return (
    <div className="min-h-screen">
      <nav className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3 text-sm">
          <Link href="/jobs" className="font-semibold">Furniture 3D Draft</Link>
          <Link href="/jobs" className="text-neutral-600 hover:text-neutral-900">History</Link>
          <Link href="/jobs/new" className="text-neutral-600 hover:text-neutral-900">New model</Link>
          {viewer.isAdmin && <Link href="/admin" className="text-neutral-600 hover:text-neutral-900">Admin</Link>}
          <form action={signOut} className="ml-auto flex items-center gap-3">
            <span className="text-neutral-500">{viewer.user.email}</span>
            <button className="text-neutral-600 hover:text-neutral-900">Sign out</button>
          </form>
        </div>
      </nav>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}

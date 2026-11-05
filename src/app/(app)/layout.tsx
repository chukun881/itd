import Link from 'next/link';
import { redirect } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { getViewer } from '@/lib/jobs';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect('/sign-in');

  return (
    <div className="min-h-screen">
      <nav className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3 text-sm">
          <Link href="/jobs" className="font-semibold">Furniture 3D Reference</Link>
          <Link href="/jobs" className="text-neutral-600 hover:text-neutral-900">History</Link>
          <Link href="/jobs/new" className="text-neutral-600 hover:text-neutral-900">New model</Link>
          {viewer.isAdmin && <Link href="/admin" className="text-neutral-600 hover:text-neutral-900">Admin</Link>}
          <div className="ml-auto"><UserButton /></div>
        </div>
      </nav>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}

import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { jobs } from '@/db/schema';
import { getViewer } from '@/lib/jobs';
import { getPresignedGetUrl } from '@/lib/r2';
import { StatusBadge, sizeLabel } from '@/components/jobs/status-badge';

export default async function JobsPage() {
  const viewer = (await getViewer())!;
  const rows = await db.select().from(jobs).where(eq(jobs.userId, viewer.user.id)).orderBy(desc(jobs.createdAt)).limit(100);
  const previews = await Promise.all(rows.map((j) => (j.outputKeys.preview ? getPresignedGetUrl(j.outputKeys.preview) : null)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Your models</h1>
        <Link href="/jobs/new" className="rounded bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700">New model</Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-neutral-500">No models yet. Start with “New model”.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((job, i) => (
            <li key={job.id}>
              <Link href={`/jobs/${job.id}`} className="block rounded-lg border border-neutral-200 bg-white p-4 hover:border-neutral-400">
                <div className="mb-3 flex aspect-square items-center justify-center overflow-hidden rounded bg-neutral-100">
                  {previews[i] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previews[i]!} alt={job.name} className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-xs text-neutral-400">No preview yet</span>
                  )}
                </div>
                <div className="font-medium">{job.name}</div>
                <div className="text-sm text-neutral-500">{sizeLabel(job)}</div>
                <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
                  <StatusBadge status={job.status} />
                  <span>{job.createdAt.toLocaleDateString('en-GB')}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

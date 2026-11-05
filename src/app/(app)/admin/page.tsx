import Link from 'next/link';
import { notFound } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { jobs, users } from '@/db/schema';
import { getViewer } from '@/lib/jobs';
import { getPresignedGetUrl } from '@/lib/r2';
import { StatusBadge, sizeLabel } from '@/components/jobs/status-badge';

export default async function AdminPage() {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) notFound();

  const rows = await db
    .select({ job: jobs, email: users.email })
    .from(jobs)
    .innerJoin(users, eq(jobs.userId, users.id))
    .orderBy(desc(jobs.createdAt))
    .limit(300);
  const thumbs = await Promise.all(
    rows.map(({ job }) => {
      const key = job.outputKeys.preview ?? job.cutoutKeys.front ?? job.inputKeys.front;
      return key ? getPresignedGetUrl(key) : null;
    }),
  );

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const thisMonth = rows.filter(({ job }) => job.createdAt >= monthStart && job.status !== 'pending');
  const spend = thisMonth.reduce((s, { job }) => s + (job.costUsd ?? 0), 0);
  const rated = rows.filter(({ job }) => job.feedbackRating);
  const avgRating = rated.length ? rated.reduce((s, { job }) => s + job.feedbackRating!, 0) / rated.length : null;
  const hours = rows.reduce((s, { job }) => s + (job.feedbackHoursSaved ?? 0), 0);
  const stepQueue = rows.filter(({ job }) => job.stepRequested && !job.outputKeys.step);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Admin</h1>
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ['Jobs this month', String(thisMonth.length)],
          ['fal spend this month', `$${spend.toFixed(2)}`],
          ['Average rating', avgRating ? `${avgRating.toFixed(1)} / 5 (${rated.length})` : '-'],
          ['Hours saved (reported)', hours.toFixed(1)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="text-xs text-neutral-500">{label}</div>
            <div className="text-lg font-semibold">{value}</div>
          </div>
        ))}
      </div>
      {stepQueue.length > 0 && (
        <p className="rounded bg-amber-50 p-3 text-sm text-amber-800">
          STEP requested for:{' '}
          {stepQueue.map(({ job }) => (
            <Link key={job.id} href={`/jobs/${job.id}`} className="mr-2 underline">{job.name}</Link>
          ))}
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs text-neutral-500">
            <tr>
              {['', 'Piece', 'User', 'Status', 'Views', 'Stretch W/D', 'Sym.', 'Seat err', 'Cost', 'Rating', 'Hours', 'Comment'].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ job, email }, i) => (
              <tr key={job.id} className="border-t border-neutral-100 align-top">
                <td className="px-3 py-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {thumbs[i] && <img src={thumbs[i]!} alt="" className="h-12 w-12 rounded object-contain" />}
                </td>
                <td className="px-3 py-2">
                  <Link href={`/jobs/${job.id}`} className="font-medium underline">{job.name || '(no name)'}</Link>
                  <div className="text-xs text-neutral-500">{sizeLabel(job)} · {job.createdAt.toLocaleDateString('en-GB')}</div>
                </td>
                <td className="px-3 py-2 text-xs">{email}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={job.status} />
                  {job.errorMessage && <div className="text-xs text-red-600">{job.errorMessage}</div>}
                </td>
                <td className="px-3 py-2">{Object.keys(job.inputKeys).length}{job.removeBackground ? ' + bg' : ''}</td>
                <td className="px-3 py-2">{job.metrics ? `${job.metrics.stretchWidthPct}% / ${job.metrics.stretchDepthPct}%` : '-'}</td>
                <td className="px-3 py-2">{job.metrics ? (job.metrics.symmetryApplied ? 'yes' : 'no') : '-'}</td>
                <td className="px-3 py-2">{job.metrics?.seatErrorMm !== undefined ? `${job.metrics.seatErrorMm} mm` : '-'}</td>
                <td className="px-3 py-2">{job.costUsd ? `$${job.costUsd.toFixed(3)}` : '-'}</td>
                <td className="px-3 py-2">{job.feedbackRating ?? '-'}</td>
                <td className="px-3 py-2">{job.feedbackHoursSaved ?? '-'}</td>
                <td className="max-w-xs px-3 py-2 text-xs text-neutral-600">{job.feedbackComment ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

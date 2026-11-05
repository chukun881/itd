'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import type { Job } from '@/db/schema';
import type { JobFileUrls } from '@/lib/jobs';
import { JOB_VIEWS, STRETCH_WARN, VIEW_LABELS } from '@/lib/shared';
import { StatusBadge, sizeLabel } from './status-badge';

const ModelViewer = dynamic(() => import('@/components/viewer/model-viewer').then((m) => m.ModelViewer), { ssr: false });

type JobJson = Omit<Job, 'createdAt' | 'submittedAt' | 'completedAt'> & { createdAt: string; completedAt: string | null };
const RUNNING: Job['status'][] = ['pending', 'submitted', 'processing'];

export function JobDetail({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<JobJson | null>(null);
  const [files, setFiles] = useState<JobFileUrls | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/jobs/${jobId}`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    setJob(data.job);
    setFiles(data.files);
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while the job is running; stop once it is completed or failed.
  useEffect(() => {
    if (!job || !RUNNING.includes(job.status)) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [job, load]);

  if (!job) return <p className="text-neutral-500">Loading...</p>;
  const m = job.metrics;

  const warnings: string[] = [];
  if (m?.stretchWidthPct !== undefined && Math.abs(m.stretchWidthPct) > STRETCH_WARN * 100) warnings.push(`Width needed ${m.stretchWidthPct}% stretch to match the given size: the AI may have misread the proportions.`);
  if (m?.stretchDepthPct !== undefined && Math.abs(m.stretchDepthPct) > STRETCH_WARN * 100) warnings.push(`Depth needed ${m.stretchDepthPct}% stretch to match the given size: the AI may have misread the proportions.`);
  if (m && !m.symmetryApplied) warnings.push('Left/right symmetry was not applied (piece looks asymmetric).');
  const SIZE_MODE = { stretched: 'fitted to the given W x D x H', scaled: 'scaled evenly to the given size', typical: 'scaled to the typical height (no size given)' };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{job.name}</h1>
        <StatusBadge status={job.status} />
        <span className="text-sm text-neutral-500">{sizeLabel(job)}</span>
      </div>
      {job.status === 'failed' && <p className="rounded bg-red-50 p-3 text-sm text-red-700">Failed: {job.errorMessage ?? 'unknown error'}</p>}
      {RUNNING.includes(job.status) && <p className="text-sm text-neutral-500">This page updates by itself. Generation takes about 3 minutes.</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {files?.viewerGlb ? (
            <ModelViewer modelUrl={files.viewerGlb} className="h-[480px] w-full" />
          ) : (
            <div className="flex h-[480px] items-center justify-center rounded-xl bg-neutral-200 text-sm text-neutral-500">3D preview appears here when ready</div>
          )}
          {files && (
            <div className="flex flex-wrap gap-3">
              {JOB_VIEWS.map((v) =>
                files.inputs[v] ? (
                  <figure key={v} className="w-28 text-center text-xs text-neutral-500">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={files.cutouts[v] ?? files.inputs[v]} alt={v} className="h-28 w-28 rounded border bg-white object-contain" />
                    <figcaption>{VIEW_LABELS[v]}{files.cutouts[v] ? ' (cut out)' : ''}</figcaption>
                  </figure>
                ) : null,
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          {job.status === 'completed' && files && (
            <section className="rounded-lg border border-neutral-200 bg-white p-4">
              <h2 className="mb-3 font-medium">Download</h2>
              <div className="flex flex-wrap gap-2 text-sm">
                {(['step', 'stl', 'obj', 'glb'] as const).map((f) =>
                  files.downloads[f] ? (
                    <a key={f} href={files.downloads[f]} className="rounded border border-neutral-300 px-3 py-1.5 uppercase hover:bg-neutral-50">{f}</a>
                  ) : null,
                )}
              </div>
              <p className="mt-2 text-xs text-neutral-500">
                All files are in mm. STEP opens in Inventor as a faceted surface body to model over (not editable features).
                STL and OBJ have more detail.
              </p>
            </section>
          )}

          {m && (
            <section className="rounded-lg border border-neutral-200 bg-white p-4 text-sm">
              <h2 className="mb-3 font-medium">Draft details</h2>
              <dl className="grid grid-cols-2 gap-y-1">
                <dt className="text-neutral-500">Size</dt><dd>{m.widthMm} x {m.depthMm} x {m.heightMm} mm</dd>
                <dt className="text-neutral-500">Sizing</dt><dd>{SIZE_MODE[m.sizeMode]}</dd>
                {m.stretchWidthPct !== undefined && (<><dt className="text-neutral-500">Stretch W / D</dt><dd>{m.stretchWidthPct}% / {m.stretchDepthPct}%</dd></>)}
                <dt className="text-neutral-500">Symmetry</dt><dd>{m.symmetryApplied ? 'applied' : 'skipped'}</dd>
                <dt className="text-neutral-500">Triangles</dt><dd>{m.faces.toLocaleString()}{m.stepFaces ? ` (STEP ${m.stepFaces.toLocaleString()})` : ''}</dd>
              </dl>
              {warnings.map((w) => <p key={w} className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-800">{w}</p>)}
            </section>
          )}

          {job.status === 'completed' && <FeedbackForm job={job} onDone={load} />}
          {job.note && <p className="text-sm text-neutral-600">Note: {job.note}</p>}
        </div>
      </div>
    </div>
  );
}

function FeedbackForm({ job, onDone }: { job: JobJson; onDone: () => void }) {
  const [rating, setRating] = useState(job.feedbackRating ?? 0);
  const [hours, setHours] = useState(job.feedbackHoursSaved?.toString() ?? '');
  const [comment, setComment] = useState(job.feedbackComment ?? '');

  async function save() {
    if (!rating) return toast.error('Choose a rating');
    const res = await fetch(`/api/jobs/${job.id}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, hoursSaved: hours === '' ? undefined : Number(hours), comment: comment || undefined }),
    });
    if (res.ok) { toast.success('Thanks for the feedback'); onDone(); } else toast.error('Could not save feedback');
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4 text-sm">
      <h2 className="mb-1 font-medium">How useful was this model?</h2>
      <p className="mb-3 text-xs text-neutral-500">Your feedback decides what we improve next.</p>
      <div className="mb-3 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setRating(n)}
            className={`h-8 w-8 rounded border ${n <= rating ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300'}`}>{n}</button>
        ))}
      </div>
      <input type="number" min={0} max={100} step={0.5} value={hours} onChange={(e) => setHours(e.target.value)}
        placeholder="Hours saved vs drawing from scratch" className="mb-2 w-full rounded border border-neutral-300 px-3 py-2" />
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={2000}
        placeholder="What was good or wrong?" className="mb-2 w-full rounded border border-neutral-300 px-3 py-2" />
      <button onClick={save} className="rounded bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-700">Save feedback</button>
    </section>
  );
}

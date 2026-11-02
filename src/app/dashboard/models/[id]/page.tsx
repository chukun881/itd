import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { jobs, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { ModelViewer } from '@/components/viewer/model-viewer';
import { getPublicModelUrl } from '@/lib/r2';
import { JOB_STATUS_CONFIG } from '@/lib/constants';
import { Box, Download, ArrowLeft, Layers, ShieldCheck, Calendar, HardDrive } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function ModelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect('/sign-in');

  const { id } = await params;

  const [dbUser] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!dbUser) redirect('/sign-in');

  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, id), eq(jobs.userId, dbUser.id)))
    .limit(1);

  if (!job) notFound();

  const modelUrl = job.processedModelKey ? getPublicModelUrl(job.processedModelKey) : null;
  const statusCfg = JOB_STATUS_CONFIG[job.status] || {
    label: job.status,
    color: 'text-neutral-500',
    bgColor: 'bg-neutral-100',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-xs font-semibold text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        {modelUrl && (
          <a
            href={modelUrl}
            download={`model-${job.id}.glb`}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
          >
            <Download className="h-4 w-4" />
            Download .GLB Model
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main 3D Canvas */}
        <div className="lg:col-span-2 rounded-3xl border bg-neutral-950 overflow-hidden shadow-sm flex items-center justify-center min-h-[550px]">
          {job.status === 'completed' && modelUrl ? (
            <ModelViewer modelUrl={modelUrl} className="w-full h-[600px]" />
          ) : (
            <div className="text-center p-8">
              <Box className="h-12 w-12 mx-auto mb-3 text-neutral-600 animate-pulse" />
              <p className="text-sm font-semibold text-white">{statusCfg.label}</p>
              <p className="text-xs text-neutral-400 mt-1">
                {job.errorMessage || 'Model generation is being processed by the pipeline'}
              </p>
            </div>
          )}
        </div>

        {/* Model Metadata & Specifications */}
        <div className="space-y-6">
          <div className="rounded-2xl border bg-white dark:bg-neutral-900 p-6 shadow-sm">
            <h2 className="text-lg font-bold mb-4">Model Specifications</h2>

            <dl className="space-y-4 text-xs">
              <div className="flex items-center justify-between pb-3 border-b">
                <dt className="text-neutral-500 flex items-center gap-1.5">
                  <Box className="h-3.5 w-3.5" /> Status
                </dt>
                <dd>
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 font-semibold ${statusCfg.bgColor} ${statusCfg.color}`}
                  >
                    {statusCfg.label}
                  </span>
                </dd>
              </div>

              <div className="flex items-center justify-between pb-3 border-b">
                <dt className="text-neutral-500 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" /> Polygon Count
                </dt>
                <dd className="font-semibold">
                  {job.polyCount ? `${job.polyCount.toLocaleString()} Triangles` : 'Optimized'}
                </dd>
              </div>

              <div className="flex items-center justify-between pb-3 border-b">
                <dt className="text-neutral-500 flex items-center gap-1.5">
                  <HardDrive className="h-3.5 w-3.5" /> File Size
                </dt>
                <dd className="font-semibold">
                  {job.processedFileSize
                    ? `${(job.processedFileSize / (1024 * 1024)).toFixed(2)} MB`
                    : 'N/A'}
                </dd>
              </div>

              <div className="flex items-center justify-between pb-3 border-b">
                <dt className="text-neutral-500 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" /> Quality Tier
                </dt>
                <dd className="font-semibold capitalize">{job.tier}</dd>
              </div>

              <div className="flex items-center justify-between">
                <dt className="text-neutral-500 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Generated At
                </dt>
                <dd className="font-semibold">{new Date(job.createdAt).toLocaleString()}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border bg-white dark:bg-neutral-900 p-6 shadow-sm">
            <h3 className="text-sm font-bold mb-2">Usage Rights & Integrations</h3>
            <p className="text-xs text-neutral-500 leading-relaxed">
              This model was generated using clean standard PBR topology. It is 100% royalty-free
              and ready for commercial export to Unity, Unreal Engine, Blender, or WebXR / AR viewers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

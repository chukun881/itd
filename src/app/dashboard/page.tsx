import React from 'react';
import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@/db';
import { users, jobs } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { GenerationStudio } from '@/components/studio/generation-studio';
import { ModelViewer } from '@/components/viewer/model-viewer';
import { getPublicModelUrl } from '@/lib/r2';
import { JOB_STATUS_CONFIG } from '@/lib/constants';
import { Sparkles, Box, Clock, Coins, Download, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return null;
  }

  // Fetch or initialize user
  let [dbUser] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);

  if (!dbUser) {
    const clerkUser = await currentUser();
    const primaryEmail = clerkUser?.emailAddresses[0]?.emailAddress ?? '';
    const fullName = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ');

    [dbUser] = await db
      .insert(users)
      .values({
        clerkId,
        email: primaryEmail,
        name: fullName || null,
        imageUrl: clerkUser?.imageUrl || null,
        credits: 3,
      })
      .returning();
  }

  // Fetch recent user jobs
  const userJobs = await db
    .select()
    .from(jobs)
    .where(eq(jobs.userId, dbUser.id))
    .orderBy(desc(jobs.createdAt))
    .limit(10);

  const completedCount = userJobs.filter((j) => j.status === 'completed').length;

  return (
    <div className="space-y-8">
      {/* Top Header / Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-neutral-500">
            Generate, preview, and download your AI-generated 3D models.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border bg-white dark:bg-neutral-900 px-4 py-2 shadow-sm">
            <Coins className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold">{dbUser.credits}</span>
            <span className="text-xs text-neutral-500">Credits</span>
          </div>

          <Link
            href="/pricing"
            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
          >
            Buy Credits
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-2xl border bg-white dark:bg-neutral-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-neutral-500">Available Credits</h3>
            <Coins className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-3 text-3xl font-bold">{dbUser.credits}</p>
          <p className="mt-1 text-xs text-neutral-400">1 credit = 1 Standard model</p>
        </div>

        <div className="rounded-2xl border bg-white dark:bg-neutral-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-neutral-500">Models Generated</h3>
            <Box className="h-4 w-4 text-blue-500" />
          </div>
          <p className="mt-3 text-3xl font-bold">{completedCount}</p>
          <p className="mt-1 text-xs text-neutral-400">Across all tiers</p>
        </div>

        <div className="rounded-2xl border bg-white dark:bg-neutral-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-neutral-500">Recent Jobs</h3>
            <Clock className="h-4 w-4 text-neutral-400" />
          </div>
          <p className="mt-3 text-3xl font-bold">{userJobs.length}</p>
          <p className="mt-1 text-xs text-neutral-400">Total lifetime tasks</p>
        </div>
      </div>

      {/* Generation Studio Section */}
      <section className="pt-2">
        <GenerationStudio />
      </section>

      {/* Recent Generations Gallery */}
      <section className="pt-6">
        <h2 className="text-lg font-bold mb-4">Your 3D Models</h2>

        {userJobs.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-white dark:bg-neutral-900 p-12 text-center text-neutral-500">
            <Box className="h-10 w-10 mx-auto mb-3 text-neutral-300 dark:text-neutral-700" />
            <p className="font-medium text-sm">No 3D models generated yet</p>
            <p className="text-xs text-neutral-400 mt-1">
              Upload an image above to generate your first textured `.glb` model!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {userJobs.map((job) => {
              const statusCfg = JOB_STATUS_CONFIG[job.status] || {
                label: job.status,
                color: 'text-neutral-500',
                bgColor: 'bg-neutral-100',
              };

              const modelUrl = job.processedModelKey
                ? getPublicModelUrl(job.processedModelKey)
                : null;

              return (
                <div
                  key={job.id}
                  className="rounded-2xl border bg-white dark:bg-neutral-900 overflow-hidden shadow-sm flex flex-col"
                >
                  <div className="relative aspect-video w-full bg-neutral-950 flex items-center justify-center">
                    {job.status === 'completed' && modelUrl ? (
                      <ModelViewer modelUrl={modelUrl} className="w-full h-full" autoRotate={false} />
                    ) : (
                      <div className="flex flex-col items-center gap-2 p-4 text-center">
                        <Box className="h-8 w-8 text-neutral-600 animate-pulse" />
                        <span className="text-xs text-neutral-400">
                          {job.status === 'processing'
                            ? 'AI is generating mesh...'
                            : job.status === 'compressing'
                            ? 'Optimizing mesh geometry...'
                            : job.status}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${statusCfg.bgColor} ${statusCfg.color}`}
                        >
                          {statusCfg.label}
                        </span>
                        <span className="text-xs text-neutral-400 capitalize">{job.tier} Tier</span>
                      </div>

                      <p className="text-xs text-neutral-500">
                        Created {new Date(job.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    {job.status === 'completed' && modelUrl && (
                      <div className="mt-4 pt-3 border-t flex items-center justify-between">
                        <a
                          href={modelUrl}
                          download
                          className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-500"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download .GLB
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

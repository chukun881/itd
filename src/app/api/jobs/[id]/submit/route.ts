import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { JobView, jobs } from '@/db/schema';
import { env } from '@/env';
import { estimateCostUsd, removeBackground, submitModel } from '@/lib/fal';
import { getViewer } from '@/lib/jobs';
import { getPresignedGetUrl, jobKey, uploadToR2 } from '@/lib/r2';

export const maxDuration = 60;

/** Start a job after its photos are uploaded: optional background removal, then queue the 3D model. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  // Atomic pending -> submitted: a double click or retry cannot start (and pay for) a job twice.
  const [job] = await db
    .update(jobs)
    .set({ status: 'submitted', submittedAt: new Date() })
    .where(and(eq(jobs.id, id), eq(jobs.userId, viewer.user.id), eq(jobs.status, 'pending')))
    .returning();
  if (!job) return NextResponse.json({ error: 'Job not found or already started' }, { status: 409 });

  try {
    const views = Object.entries(job.inputKeys) as [JobView, string][];
    const urls: Partial<Record<JobView, string>> = {};
    const cutoutKeys: Partial<Record<JobView, string>> = {};

    await Promise.all(
      views.map(async ([view, key]) => {
        const photoUrl = await getPresignedGetUrl(key, 3600);
        if (!job.removeBackground) {
          urls[view] = photoUrl;
          return;
        }
        const cutoutUrl = await removeBackground(photoUrl);
        urls[view] = cutoutUrl;
        const png = new Uint8Array(await (await fetch(cutoutUrl)).arrayBuffer());
        cutoutKeys[view] = jobKey(job.id, `cutout-${view}.png`);
        await uploadToR2(cutoutKeys[view]!, png, 'image/png');
      }),
    );

    const requestId = await submitModel(urls, `${env.NEXT_PUBLIC_APP_URL}/api/webhook/fal`);
    await db
      .update(jobs)
      .set({ providerTaskId: requestId, cutoutKeys, costUsd: estimateCostUsd(views.length, job.removeBackground) })
      .where(eq(jobs.id, job.id));
    return NextResponse.json({ status: 'submitted' });
  } catch (err) {
    console.error(`submit ${job.id} failed:`, err);
    await db
      .update(jobs)
      .set({ status: 'failed', errorMessage: err instanceof Error ? err.message : 'Submit failed' })
      .where(eq(jobs.id, job.id));
    return NextResponse.json({ error: 'Could not start the 3D generation' }, { status: 502 });
  }
}

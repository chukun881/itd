import { NextRequest, NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { jobs } from '@/db/schema';
import { getAccessibleJob, getViewer } from '@/lib/jobs';
import { getPresignedPutUrl, jobKey } from '@/lib/r2';

/**
 * Admin only. POST returns an upload URL for the STEP file; after the browser
 * uploads it, PUT marks the STEP as available on the job.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const job = await getAccessibleJob((await params).id, viewer);
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const url = await getPresignedPutUrl(jobKey(job.id, 'model.step'), 'application/step', 600);
  return NextResponse.json({ uploadUrl: url, contentType: 'application/step' });
}

export async function PUT(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const job = await getAccessibleJob((await params).id, viewer);
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const key = jobKey(job.id, 'model.step');
  await db
    .update(jobs)
    .set({ outputKeys: sql`${jobs.outputKeys} || jsonb_build_object('step', ${key}::text)` })
    .where(eq(jobs.id, job.id));
  return NextResponse.json({ ok: true });
}

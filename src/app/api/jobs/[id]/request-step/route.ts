import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { jobs } from '@/db/schema';
import { getAccessibleJob, getViewer } from '@/lib/jobs';

/** Flag a completed job for a STEP file; the admin converts and uploads it by hand. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const job = await getAccessibleJob((await params).id, viewer);
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db
    .update(jobs)
    .set({ stepRequested: true })
    .where(and(eq(jobs.id, job.id), eq(jobs.status, 'completed')));
  return NextResponse.json({ ok: true });
}

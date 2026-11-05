import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { jobs } from '@/db/schema';
import { feedbackSchema } from '@/lib/job-input';
import { getAccessibleJob, getViewer } from '@/lib/jobs';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const job = await getAccessibleJob((await params).id, viewer);
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const parsed = feedbackSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid feedback' }, { status: 400 });

  await db
    .update(jobs)
    .set({
      feedbackRating: parsed.data.rating,
      feedbackHoursSaved: parsed.data.hoursSaved ?? null,
      feedbackComment: parsed.data.comment || null,
    })
    .where(eq(jobs.id, job.id));
  return NextResponse.json({ ok: true });
}

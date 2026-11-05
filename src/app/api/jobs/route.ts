import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { JobView, jobs } from '@/db/schema';
import { env } from '@/env';
import { createJobSchema, extensionFor } from '@/lib/job-input';
import { getViewer, jobsThisMonth } from '@/lib/jobs';
import { getPresignedPutUrl, jobKey } from '@/lib/r2';

/** Create a job and return one presigned upload URL per photo. */
export async function POST(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = createJobSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  const used = await jobsThisMonth(viewer.user.id);
  if (used >= env.MONTHLY_JOB_CAP) {
    return NextResponse.json({ error: `Monthly limit of ${env.MONTHLY_JOB_CAP} jobs reached` }, { status: 429 });
  }

  const jobId = crypto.randomUUID();
  const inputKeys: Partial<Record<JobView, string>> = {};
  for (const p of input.photos) inputKeys[p.view] = jobKey(jobId, `input-${p.view}.${extensionFor(p.contentType)}`);

  await db.insert(jobs).values({
    id: jobId,
    userId: viewer.user.id,
    status: 'pending',
    name: input.name,
    note: input.note || null,
    widthMm: input.widthMm,
    depthMm: input.depthMm,
    heightMm: input.heightMm,
    seatHeightMm: input.seatHeightMm ?? null,
    armHeightMm: input.armHeightMm ?? null,
    removeBackground: input.removeBackground,
    inputKeys,
  });

  const uploads = await Promise.all(
    input.photos.map(async (p) => ({
      view: p.view,
      url: await getPresignedPutUrl(inputKeys[p.view]!, p.contentType, 600),
      contentType: p.contentType,
    })),
  );
  return NextResponse.json({ jobId, uploads });
}

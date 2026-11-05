import { NextRequest, NextResponse } from 'next/server';
import { getAccessibleJob, getViewer, jobFileUrls } from '@/lib/jobs';

/** Job status, numbers and short-lived file URLs (owner or admin). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const job = await getAccessibleJob((await params).id, viewer);
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Internal provider fields stay on the server.
  const visible = { ...job, providerMeta: undefined, providerTaskId: undefined, rawModelKey: undefined };
  return NextResponse.json({ job: visible, files: job.status === 'completed' || viewer.isAdmin ? await jobFileUrls(job) : null });
}

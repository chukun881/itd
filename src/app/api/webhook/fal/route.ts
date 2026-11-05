import { NextRequest, NextResponse, after } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { jobs } from '@/db/schema';
import type { FalModelOutput } from '@/lib/fal';
import { readFalWebhookHeaders, verifyFalWebhook } from '@/lib/fal-webhook';
import { processJob } from '@/lib/process-job';

export const maxDuration = 60;

interface FalWebhookBody {
  request_id?: string;
  status?: 'OK' | 'ERROR';
  payload?: FalModelOutput | null;
  error?: string;
}

/**
 * fal calls this when a queued model finishes. Answer fast (fal waits 15 s) and do
 * the mesh work after the response. Safe against retries: each job moves
 * submitted -> processing exactly once.
 */
export async function POST(req: NextRequest) {
  const raw = new Uint8Array(await req.arrayBuffer());
  const headers = readFalWebhookHeaders(req.headers);
  if (!(await verifyFalWebhook(headers, raw))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let body: FalWebhookBody;
  try {
    body = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const requestId = body.request_id ?? headers.requestId!;

  const [existing] = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.providerTaskId, requestId)).limit(1);
  if (!existing) {
    // Not ours yet (the submit may still be saving the id): 404 makes fal retry later.
    return NextResponse.json({ error: 'Unknown request' }, { status: 404 });
  }

  if (body.status !== 'OK') {
    await db
      .update(jobs)
      .set({ status: 'failed', errorMessage: body.error ?? 'Generation failed at fal', providerMeta: body })
      .where(and(eq(jobs.id, existing.id), eq(jobs.status, 'submitted')));
    return NextResponse.json({ ok: true });
  }

  const [job] = await db
    .update(jobs)
    .set({ status: 'processing', providerMeta: body })
    .where(and(eq(jobs.id, existing.id), eq(jobs.status, 'submitted')))
    .returning();
  if (!job) return NextResponse.json({ ok: true, note: 'already handled' });

  after(() => processJob(job, body.payload ?? null));
  return NextResponse.json({ ok: true });
}

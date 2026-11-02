import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { jobs } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { acquireProviderSlot } from '@/lib/redis';
import { getPresignedGetUrl } from '@/lib/r2';
import { dispatchGenerationTask } from '@/lib/providers';
import { env } from '@/env';

export async function POST(req: NextRequest) {
  try {
    // 1. Process queued jobs in FIFO order
    const queuedJobs = await db
      .select()
      .from(jobs)
      .where(eq(jobs.status, 'queued'))
      .orderBy(asc(jobs.createdAt))
      .limit(5);

    if (queuedJobs.length === 0) {
      return NextResponse.json({ message: 'No queued jobs' }, { status: 200 });
    }

    let processedCount = 0;

    for (const job of queuedJobs) {
      const hasSlot = await acquireProviderSlot(job.provider);
      if (!hasSlot) {
        console.log(`Provider ${job.provider} still at capacity; stopping queue processing`);
        break;
      }

      if (!job.inputImageKey) continue;

      const inputDownloadUrl = await getPresignedGetUrl(job.inputImageKey, 3600);
      const webhookUrl = `${env.NEXT_PUBLIC_APP_URL}/api/webhook/tripo`;

      const result = await dispatchGenerationTask({
        jobId: job.id,
        imageUrl: inputDownloadUrl,
        tier: job.tier,
        webhookUrl,
      });

      await db
        .update(jobs)
        .set({
          status: result.provider === 'mock' ? 'processing' : 'submitted',
          providerTaskId: result.providerTaskId,
          submittedAt: new Date(),
          providerMeta: result.meta,
        })
        .where(eq(jobs.id, job.id));

      processedCount++;
    }

    return NextResponse.json({ processed: processedCount }, { status: 200 });
  } catch (err: unknown) {
    console.error('Error processing queue:', err);
    return NextResponse.json({ error: 'Queue processing failed' }, { status: 500 });
  }
}

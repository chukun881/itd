import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { db } from '@/db';
import { users, jobs, creditTransactions } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { generateRateLimit, acquireProviderSlot } from '@/lib/redis';
import { getPresignedGetUrl } from '@/lib/r2';
import { GENERATION_COSTS, PROVIDER_CONFIG } from '@/lib/constants';
import { env } from '@/env';

const generateRequestSchema = z.object({
  jobId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Upstash sliding-window rate limit (5 req/min per user)
    const { success, reset } = await generateRateLimit.limit(clerkId);
    if (!success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait before generating again.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)) } }
      );
    }

    // 2. Validate payload
    const body = await req.json();
    const parsed = generateRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { jobId } = parsed.data;

    // 3. Find the user and verify ownership
    const [dbUser] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (!dbUser) {
      return NextResponse.json({ error: 'User record not found' }, { status: 404 });
    }

    const [job] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.userId, dbUser.id)))
      .limit(1);

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (job.status !== 'pending' && job.status !== 'uploading') {
      return NextResponse.json(
        { error: `Job cannot be started from current status: ${job.status}` },
        { status: 400 }
      );
    }

    const creditCost = GENERATION_COSTS[job.tier];

    // 4. ATOMIC Credit Deduction: Single SQL query to prevent race condition abuse
    const deductionResult = await db.execute(sql`
      UPDATE ${users}
      SET credits = credits - ${creditCost},
          updated_at = NOW()
      WHERE id = ${dbUser.id} AND credits >= ${creditCost}
      RETURNING credits;
    `);

    if (!deductionResult.rows || deductionResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Insufficient credits to start generation', required: creditCost },
        { status: 402 }
      );
    }

    const remainingCredits = Number(deductionResult.rows[0].credits);

    // 5. Log credit transaction
    await db.insert(creditTransactions).values({
      userId: dbUser.id,
      amount: -creditCost,
      type: 'generation',
      jobId: job.id,
      description: `Generation job (${job.tier} tier)`,
    });

    // 6. Attempt to acquire concurrency slot for provider
    const hasSlot = await acquireProviderSlot(job.provider);

    if (!hasSlot) {
      // Concurrency ceiling reached -> Queue job for automated consumer pickup
      await db
        .update(jobs)
        .set({
          status: 'queued',
        })
        .where(eq(jobs.id, job.id));

      return NextResponse.json({
        jobId: job.id,
        status: 'queued',
        message: 'Generation queued. System is currently running at peak concurrency.',
        creditsRemaining: remainingCredits,
      });
    }

    // 7. Slot acquired: Dispatch task via unified provider layer (Tripo / Rodin / Meshy / Mock)
    if (!job.inputImageKey) {
      return NextResponse.json({ error: 'Job input image key is missing' }, { status: 400 });
    }

    const inputDownloadUrl = await getPresignedGetUrl(job.inputImageKey, 3600);
    const webhookUrl = `${env.NEXT_PUBLIC_APP_URL}/api/webhook/tripo`;

    try {
      const { dispatchGenerationTask } = await import('@/lib/providers');

      const dispatchResult = await dispatchGenerationTask({
        jobId: job.id,
        imageUrl: inputDownloadUrl,
        tier: job.tier,
        webhookUrl,
      });

      // 8. Update job record with provider task ID
      await db
        .update(jobs)
        .set({
          status: dispatchResult.provider === 'mock' ? 'processing' : 'submitted',
          providerTaskId: dispatchResult.providerTaskId,
          submittedAt: new Date(),
          providerMeta: dispatchResult.meta,
        })
        .where(eq(jobs.id, job.id));

      return NextResponse.json({
        jobId: job.id,
        status: dispatchResult.provider === 'mock' ? 'processing' : 'submitted',
        providerTaskId: dispatchResult.providerTaskId,
        creditsRemaining: remainingCredits,
      });
    } catch (providerError: unknown) {
      console.error('Failed to dispatch job to provider, refunding credit:', providerError);

      // Hot rollback / auto-refund on immediate dispatch error
      await db.execute(sql`
        UPDATE ${users}
        SET credits = credits + ${creditCost},
            updated_at = NOW()
        WHERE id = ${dbUser.id};
      `);

      await db.insert(creditTransactions).values({
        userId: dbUser.id,
        amount: creditCost,
        type: 'refund',
        jobId: job.id,
        description: 'Auto-refund: Provider dispatch error',
      });

      await db
        .update(jobs)
        .set({
          status: 'failed',
          errorMessage: providerError instanceof Error ? providerError.message : 'Provider dispatch error',
        })
        .where(eq(jobs.id, job.id));

      return NextResponse.json(
        { error: 'Failed to initiate 3D generation. Credits have been refunded.' },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error('Error in /api/generate:', error);
    return NextResponse.json(
      { error: 'Internal server error while initiating generation' },
      { status: 500 }
    );
  }
}

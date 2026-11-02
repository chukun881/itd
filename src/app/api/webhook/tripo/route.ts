import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, jobs, creditTransactions } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { isWebhookProcessed, releaseProviderSlot, redis } from '@/lib/redis';
import { uploadToR2, R2_PREFIXES, getPublicModelUrl } from '@/lib/r2';
import { GENERATION_COSTS } from '@/lib/constants';
import { env } from '@/env';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const deliveryId = req.headers.get('Tripo-Webhook-Delivery') || req.headers.get('x-delivery-id');

    // 1. Idempotency Check: Prevent duplicate processing if webhook is retried
    if (deliveryId) {
      const alreadyProcessed = await isWebhookProcessed(deliveryId);
      if (alreadyProcessed) {
        return NextResponse.json({ message: 'Delivery already processed' }, { status: 200 });
      }
    }

    const payload = JSON.parse(rawBody);
    const taskId = payload.data?.task_id || payload.task_id;

    if (!taskId) {
      return NextResponse.json({ error: 'Missing task_id in webhook payload' }, { status: 400 });
    }

    // 2. Lookup corresponding job in database
    const [job] = await db.select().from(jobs).where(eq(jobs.providerTaskId, taskId)).limit(1);

    if (!job) {
      console.warn(`Webhook received for unknown providerTaskId: ${taskId}`);
      return NextResponse.json({ message: 'Job not found in system' }, { status: 200 });
    }

    // 3. Release distributed semaphore slot for provider
    await releaseProviderSlot(job.provider);

    const taskStatus = payload.data?.status || payload.status; // 'success' | 'failed' | 'cancelled'

    // 4. Handle Generation Failure
    if (taskStatus === 'failed' || taskStatus === 'cancelled') {
      const creditCost = GENERATION_COSTS[job.tier];

      // Atomic Credit Refund
      await db.execute(sql`
        UPDATE ${users}
        SET credits = credits + ${creditCost},
            updated_at = NOW()
        WHERE id = ${job.userId};
      `);

      await db.insert(creditTransactions).values({
        userId: job.userId,
        amount: creditCost,
        type: 'refund',
        jobId: job.id,
        description: `Refund: Provider generation ${taskStatus}`,
      });

      await db
        .update(jobs)
        .set({
          status: 'failed',
          errorMessage: payload.data?.error || payload.error || `Provider reported ${taskStatus}`,
          providerMeta: payload,
        })
        .where(eq(jobs.id, job.id));

      // Publish event to Redis channel for live frontend notification
      await redis.publish(
        `job:${job.id}`,
        JSON.stringify({ status: 'failed', error: 'Generation failed at provider' })
      );

      return NextResponse.json({ status: 'refunded_and_failed' }, { status: 200 });
    }

    // 5. Handle Generation Success
    if (taskStatus === 'success') {
      const outputModelUrl =
        payload.data?.output?.model ||
        payload.data?.output?.pbr_model ||
        payload.output?.model;

      if (!outputModelUrl) {
        throw new Error('Task marked success but no model URL provided by provider');
      }

      await db
        .update(jobs)
        .set({
          status: 'compressing',
          rawModelKey: `${R2_PREFIXES.RAW_MODELS}/${job.id}-raw.glb`,
          providerMeta: payload,
        })
        .where(eq(jobs.id, job.id));

      // Notify frontend of compression phase
      await redis.publish(`job:${job.id}`, JSON.stringify({ status: 'compressing' }));

      // 6. Download raw GLB from provider CDN immediately (Provider URLs expire within 24-48h)
      const modelResponse = await fetch(outputModelUrl);
      if (!modelResponse.ok) {
        throw new Error(`Failed to download model from provider CDN: ${modelResponse.statusText}`);
      }

      const modelBuffer = Buffer.from(await modelResponse.arrayBuffer());
      const rawModelKey = `${R2_PREFIXES.RAW_MODELS}/${job.id}-raw.glb`;
      const processedModelKey = `${R2_PREFIXES.PROCESSED_MODELS}/${job.id}.glb`;

      // Store raw backup
      await uploadToR2(rawModelKey, modelBuffer);

      // If Lambda compression worker is configured, delegate optimization
      if (env.COMPRESSION_LAMBDA_URL) {
        fetch(env.COMPRESSION_LAMBDA_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': env.INTERNAL_API_SECRET,
          },
          body: JSON.stringify({
            jobId: job.id,
            rawGlbKey: rawModelKey,
          }),
        }).catch((err) => console.error('Error invoking compression Lambda:', err));
      } else {
        // Run in-process 3D optimization (gltf-transform + Draco + Meshopt)
        let optimizedDesktop: Buffer = Buffer.from(modelBuffer);
        let optimizedMobile: Buffer = Buffer.from(modelBuffer);
        let polyCount = 0;

        try {
          const { optimizeGlb } = await import('@/lib/compression');
          const optResult = await optimizeGlb(modelBuffer);
          optimizedDesktop = Buffer.from(optResult.desktopGlb);
          optimizedMobile = Buffer.from(optResult.mobileGlb);
          polyCount = optResult.desktopPolyCount;

          // Upload mobile variant
          const mobileKey = `${R2_PREFIXES.PROCESSED_MODELS}/${job.id}/mobile.glb`;
          await uploadToR2(mobileKey, optimizedMobile);
        } catch (optError) {
          console.warn('Mesh decimation fallback to raw buffer:', optError);
        }

        // Upload desktop / default variant
        await uploadToR2(processedModelKey, optimizedDesktop);

        await db
          .update(jobs)
          .set({
            status: 'completed',
            processedModelKey,
            rawFileSize: modelBuffer.length,
            processedFileSize: optimizedDesktop.length,
            polyCount: polyCount || null,
            completedAt: new Date(),
          })
          .where(eq(jobs.id, job.id));

        // Publish live completion event to frontend subscriber
        const publicUrl = getPublicModelUrl(processedModelKey);
        await redis.publish(
          `job:${job.id}`,
          JSON.stringify({
            status: 'completed',
            modelUrl: publicUrl,
            fileSize: optimizedDesktop.length,
            polyCount,
          })
        );
      }

      return NextResponse.json({ status: 'received_and_processing' }, { status: 200 });
    }

    return NextResponse.json({ status: 'ignored_state' }, { status: 200 });
  } catch (error) {
    console.error('Error in Tripo webhook handler:', error);
    return NextResponse.json({ error: 'Internal error processing webhook' }, { status: 500 });
  }
}

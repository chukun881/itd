import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { jobs, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getPublicModelUrl } from '@/lib/r2';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel function limit for SSE streaming

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { jobId } = await params;

    // Verify user owns this job
    const [dbUser] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (!dbUser) {
      return new NextResponse('User not found', { status: 404 });
    }

    const [job] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.userId, dbUser.id)))
      .limit(1);

    if (!job) {
      return new NextResponse('Job not found', { status: 404 });
    }

    const encoder = new TextEncoder();

    // Stream SSE to client
    const stream = new ReadableStream({
      async start(controller) {
        // Send initial current state immediately
        const initialPayload = {
          status: job.status,
          modelUrl: job.processedModelKey ? getPublicModelUrl(job.processedModelKey) : null,
          error: job.errorMessage,
        };

        controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialPayload)}\n\n`));

        // If job is already in a terminal state, close stream
        if (job.status === 'completed' || job.status === 'failed' || job.status === 'refunded') {
          controller.close();
          return;
        }

        // Lightweight polling fallback loop (checking DB status every 2 seconds for up to ~56 seconds)
        let iterations = 0;
        const maxIterations = 28; // ~56 seconds (within 60s maxDuration)

        const intervalId = setInterval(async () => {
          iterations++;

          try {
            const [currentJob] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);

            if (!currentJob) {
              clearInterval(intervalId);
              controller.close();
              return;
            }

            const payload = {
              status: currentJob.status,
              modelUrl: currentJob.processedModelKey
                ? getPublicModelUrl(currentJob.processedModelKey)
                : null,
              error: currentJob.errorMessage,
              processedFileSize: currentJob.processedFileSize,
            };

            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

            if (
              currentJob.status === 'completed' ||
              currentJob.status === 'failed' ||
              currentJob.status === 'refunded' ||
              iterations >= maxIterations
            ) {
              clearInterval(intervalId);
              controller.close();
            }
          } catch (pollErr) {
            console.error('Error in SSE polling loop:', pollErr);
            clearInterval(intervalId);
            controller.close();
          }
        }, 2000);

        req.signal.addEventListener('abort', () => {
          clearInterval(intervalId);
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    console.error('Error establishing SSE stream:', err);
    return new NextResponse('Internal error', { status: 500 });
  }
}

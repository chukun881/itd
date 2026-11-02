import { ProviderClient, GenerationTaskOptions, GenerationTaskResult } from './types';
import { db } from '@/db';
import { jobs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { uploadToR2, R2_PREFIXES, getPublicModelUrl } from '@/lib/r2';
import { redis } from '@/lib/redis';

/**
 * Mock 3D Provider for local development, demoing, and testing
 * when TRIPO_API_KEY is not configured.
 * Generates a valid sample GLB or simulates the async webhook lifecycle.
 */
export class Mock3DClient implements ProviderClient {
  readonly name = 'mock' as const;

  async submitTask(options: GenerationTaskOptions): Promise<GenerationTaskResult> {
    const mockTaskId = `mock-task-${Date.now()}`;

    // Simulate async provider completion in background after 4 seconds
    setTimeout(async () => {
      try {
        console.log(`[Mock Provider] Simulating generation completion for job: ${options.jobId}`);

        // Sample publicly accessible GLB model (Suzanne Monkey or Duck from Khronos repo)
        const sampleGlbUrl =
          'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF-Binary/Duck.glb';

        const res = await fetch(sampleGlbUrl);
        if (!res.ok) throw new Error('Failed to fetch sample GLB for mock generation');

        const glbBuffer = Buffer.from(await res.arrayBuffer());
        const processedModelKey = `${R2_PREFIXES.PROCESSED_MODELS}/${options.jobId}.glb`;

        // Upload to R2 if configured, or store locally
        try {
          await uploadToR2(processedModelKey, glbBuffer);
        } catch {
          // If R2 is not configured in local environment, proceed gracefully
        }

        await db
          .update(jobs)
          .set({
            status: 'completed',
            processedModelKey,
            rawFileSize: glbBuffer.length,
            processedFileSize: glbBuffer.length,
            polyCount: 4200,
            completedAt: new Date(),
          })
          .where(eq(jobs.id, options.jobId));

        // Publish live SSE event
        const publicUrl = getPublicModelUrl(processedModelKey);
        try {
          await redis.publish(
            `job:${options.jobId}`,
            JSON.stringify({
              status: 'completed',
              modelUrl: publicUrl,
              fileSize: glbBuffer.length,
            })
          );
        } catch {
          // In local mode if redis is offline, polling fallback handles it
        }
      } catch (err) {
        console.error('[Mock Provider Error]:', err);
      }
    }, 4000);

    return {
      providerTaskId: mockTaskId,
      provider: 'mock',
      meta: { mode: 'simulation' },
    };
  }
}

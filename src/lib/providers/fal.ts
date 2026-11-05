import { createFalClient } from '@fal-ai/client';
import { ProviderClient, GenerationTaskOptions, GenerationTaskResult } from './types';
import { FAL_MODELS } from '@/lib/constants';
import { env } from '@/env';

/**
 * fal.ai provider. Submits to the fal queue and returns immediately;
 * fal calls `webhookUrl` when the job finishes. Server-side only.
 */
export class FalProvider implements ProviderClient {
  readonly name = 'fal' as const;

  async submitTask(options: GenerationTaskOptions): Promise<GenerationTaskResult> {
    if (!env.FAL_KEY) {
      throw new Error('FAL_KEY is not configured');
    }

    const model = FAL_MODELS[options.tier];
    const client = createFalClient({ credentials: env.FAL_KEY });

    // Submit once only: a second submit is a new billable job.
    const { request_id } = await client.queue.submit(model.endpoint, {
      input: { input_image_url: options.imageUrl, ...model.input },
      webhookUrl: options.webhookUrl,
    });

    return {
      providerTaskId: request_id,
      provider: 'fal',
      meta: { endpoint: model.endpoint },
    };
  }
}

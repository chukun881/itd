import { ProviderClient, GenerationTaskOptions, GenerationTaskResult } from './types';
import { env } from '@/env';

export class MeshyClient implements ProviderClient {
  readonly name = 'meshy' as const;

  async submitTask(options: GenerationTaskOptions): Promise<GenerationTaskResult> {
    if (!env.MESHY_API_KEY) {
      throw new Error('MESHY_API_KEY is not configured');
    }

    const response = await fetch('https://api.meshy.ai/openapi/v2/image-to-3d', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.MESHY_API_KEY}`,
      },
      body: JSON.stringify({
        image_url: options.imageUrl,
        enable_pbr: options.tier === 'premium',
        webhook_url: options.webhookUrl,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Meshy API error: ${data.message || response.statusText}`);
    }

    return {
      providerTaskId: data.result,
      provider: 'meshy',
      meta: data,
    };
  }
}

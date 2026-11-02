import { ProviderClient, GenerationTaskOptions, GenerationTaskResult } from './types';
import { env } from '@/env';

export class RodinClient implements ProviderClient {
  readonly name = 'rodin' as const;

  async submitTask(options: GenerationTaskOptions): Promise<GenerationTaskResult> {
    if (!env.RODIN_API_KEY) {
      throw new Error('RODIN_API_KEY is not configured');
    }

    // Direct Hyper3D / fal.ai queue dispatch
    const response = await fetch('https://api.hyper3d.ai/v1/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.RODIN_API_KEY}`,
      },
      body: JSON.stringify({
        input_image: options.imageUrl,
        quality: options.tier === 'premium' ? 'high' : 'standard',
        topology: 'quad',
        webhook_url: options.webhookUrl,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Rodin API error: ${data.error || response.statusText}`);
    }

    return {
      providerTaskId: data.task_id || data.id,
      provider: 'rodin',
      meta: data,
    };
  }
}

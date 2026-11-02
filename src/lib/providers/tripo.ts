import { ProviderClient, GenerationTaskOptions, GenerationTaskResult } from './types';
import { env } from '@/env';

export class TripoClient implements ProviderClient {
  readonly name = 'tripo' as const;

  async submitTask(options: GenerationTaskOptions): Promise<GenerationTaskResult> {
    const modelVersion = options.tier === 'premium' ? 'p1.0' : 'v3.1';

    const response = await fetch('https://api.tripo3d.ai/v2/openapi/task', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.TRIPO_API_KEY}`,
      },
      body: JSON.stringify({
        type: 'image_to_model',
        file: {
          type: 'jpg',
          url: options.imageUrl,
        },
        model_version: modelVersion,
        texture: true,
        webhook: options.webhookUrl,
      }),
    });

    const data = await response.json();

    if (!response.ok || data.code !== 0) {
      throw new Error(`Tripo3D API error: ${data.message || response.statusText}`);
    }

    const providerTaskId = data.data?.task_id;
    if (!providerTaskId) {
      throw new Error('Tripo3D API response missing task_id');
    }

    return {
      providerTaskId,
      provider: 'tripo',
      meta: data,
    };
  }

  async checkBalance(): Promise<{ credits: number }> {
    const res = await fetch('https://api.tripo3d.ai/v2/openapi/user/balance', {
      headers: { Authorization: `Bearer ${env.TRIPO_API_KEY}` },
    });
    const data = await res.json();
    return { credits: data.data?.balance ?? 0 };
  }
}

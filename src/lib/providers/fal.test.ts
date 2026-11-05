import { beforeEach, describe, expect, it, vi } from 'vitest';

const submit = vi.fn();
vi.mock('@fal-ai/client', () => ({
  createFalClient: () => ({ queue: { submit } }),
}));
vi.mock('@/env', () => ({ env: { FAL_KEY: 'test-key' } }));

const { FalProvider } = await import('./fal');

describe('FalProvider.submitTask', () => {
  beforeEach(() => {
    submit.mockReset();
  });

  it('submits the premium tier to Hunyuan Pro with PBR and the webhook', async () => {
    submit.mockResolvedValue({ request_id: 'req_123' });

    const result = await new FalProvider().submitTask({
      jobId: 'job-1',
      imageUrl: 'https://example.com/in.png',
      tier: 'premium',
      webhookUrl: 'https://app.example.com/api/webhook/fal',
    });

    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith('fal-ai/hunyuan-3d/v3.1/pro/image-to-3d', {
      input: { input_image_url: 'https://example.com/in.png', enable_pbr: true },
      webhookUrl: 'https://app.example.com/api/webhook/fal',
    });
    expect(result).toEqual({
      providerTaskId: 'req_123',
      provider: 'fal',
      meta: { endpoint: 'fal-ai/hunyuan-3d/v3.1/pro/image-to-3d' },
    });
  });

  it('does not retry when the submit fails', async () => {
    submit.mockRejectedValue(new Error('network'));

    await expect(
      new FalProvider().submitTask({
        jobId: 'job-1',
        imageUrl: 'https://example.com/in.png',
        tier: 'standard',
        webhookUrl: 'https://app.example.com/api/webhook/fal',
      }),
    ).rejects.toThrow('network');
    expect(submit).toHaveBeenCalledTimes(1);
  });
});

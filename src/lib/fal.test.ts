import { beforeEach, describe, expect, it, vi } from 'vitest';

const submit = vi.fn();
vi.mock('@fal-ai/client', () => ({ createFalClient: () => ({ queue: { submit } }) }));
vi.mock('@/env', () => ({ env: { FAL_KEY: 'test-key' } }));

const { estimateCostUsd, isFalMediaUrl, submitModel, FAL } = await import('./fal');

describe('submitModel', () => {
  beforeEach(() => {
    submit.mockReset();
  });

  it('sends geometry mode with every provided view and the webhook, once', async () => {
    submit.mockResolvedValue({ request_id: 'req_1' });
    const id = await submitModel(
      { front: 'https://x/front.png', left: 'https://x/left.png', right_front: 'https://x/rf.png' },
      'https://app.example.com/api/webhook/fal',
    );
    expect(id).toBe('req_1');
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith(FAL.modelEndpoint, {
      input: {
        input_image_url: 'https://x/front.png',
        generate_type: 'Geometry',
        left_image_url: 'https://x/left.png',
        right_front_image_url: 'https://x/rf.png',
      },
      webhookUrl: 'https://app.example.com/api/webhook/fal',
    });
  });

  it('refuses to submit without a front photo', async () => {
    await expect(submitModel({ back: 'https://x/b.png' }, 'https://w')).rejects.toThrow('front');
    expect(submit).not.toHaveBeenCalled();
  });
});

describe('estimateCostUsd', () => {
  it('adds multi-view and background removal per photo', () => {
    expect(estimateCostUsd(1, false)).toBe(0.375);
    expect(estimateCostUsd(3, true)).toBe(0.579); // 0.375 + 0.15 + 3 x 0.018
    expect(estimateCostUsd(1, true, true)).toBe(0.405); // guided cut-out 0.03
  });
});

describe('isFalMediaUrl', () => {
  it('only allows https fal.media hosts', () => {
    expect(isFalMediaUrl('https://v3b.fal.media/files/a/model.glb')).toBe(true);
    expect(isFalMediaUrl('http://v3b.fal.media/files/a/model.glb')).toBe(false);
    expect(isFalMediaUrl('https://evil.com/fal.media/model.glb')).toBe(false);
    expect(isFalMediaUrl('https://fal.media.evil.com/x')).toBe(false);
  });
});

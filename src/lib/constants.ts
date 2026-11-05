/**
 * fal.ai model per tier. Replaced by the MVP pipeline settings in the next PR.
 * Prices from fal model pages (2026-11-05): Rapid $0.225; Pro $0.375 + $0.15 PBR.
 */
export const FAL_MODELS = {
  standard: {
    endpoint: 'fal-ai/hunyuan-3d/v3.1/rapid/image-to-3d',
    input: {},
  },
  premium: {
    endpoint: 'fal-ai/hunyuan-3d/v3.1/pro/image-to-3d',
    input: { enable_pbr: true },
  },
} as const;

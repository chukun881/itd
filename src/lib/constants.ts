/**
 * Credit pricing tiers for Stripe Checkout.
 */
export const CREDIT_PACKS = [
  { id: 'pack_10', credits: 10, price: 999, label: '10 Credits', priceLabel: '$9.99' },
  { id: 'pack_50', credits: 50, price: 3999, label: '50 Credits', priceLabel: '$39.99' },
  { id: 'pack_200', credits: 200, price: 12999, label: '200 Credits', priceLabel: '$129.99' },
] as const;

/**
 * Credit costs per generation tier.
 */
export const GENERATION_COSTS = {
  standard: 1,
  premium: 3,
} as const;

/**
 * Provider configuration — maps tiers to providers and default model versions.
 */
export const PROVIDER_CONFIG = {
  standard: {
    provider: 'tripo' as const,
    modelVersion: 'v3.1',
    texture: true,
    expectedDurationMs: 60_000, // ~60 seconds
  },
  premium: {
    provider: 'rodin' as const,
    modelVersion: 'gen-2.5-high',
    texture: true,
    expectedDurationMs: 120_000, // ~120 seconds
  },
} as const;

/**
 * Job status display labels and colors.
 */
export const JOB_STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'text-gray-500', bgColor: 'bg-gray-100' },
  uploading: { label: 'Uploading', color: 'text-blue-500', bgColor: 'bg-blue-100' },
  queued: { label: 'In Queue', color: 'text-yellow-500', bgColor: 'bg-yellow-100' },
  submitted: { label: 'Submitted', color: 'text-indigo-500', bgColor: 'bg-indigo-100' },
  processing: { label: 'Generating 3D', color: 'text-purple-500', bgColor: 'bg-purple-100' },
  compressing: { label: 'Optimizing', color: 'text-cyan-500', bgColor: 'bg-cyan-100' },
  completed: { label: 'Ready', color: 'text-green-600', bgColor: 'bg-green-100' },
  failed: { label: 'Failed', color: 'text-red-500', bgColor: 'bg-red-100' },
  refunded: { label: 'Refunded', color: 'text-orange-500', bgColor: 'bg-orange-100' },
} as const;

/**
 * Free credits given to new users on signup.
 */
export const FREE_CREDITS_ON_SIGNUP = 3;

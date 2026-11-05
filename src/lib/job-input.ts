import { z } from 'zod';
import { JOB_VIEWS, PIECE_TYPES } from '@/lib/shared';

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/** Hard minimum. Online photos are often small, so this is low. */
export const MIN_IMAGE_SHORT_SIDE = 512;
/** Below this the form warns that the draft will be rougher. */
export const GOOD_IMAGE_SHORT_SIDE = 768;

const mm = (min: number, max: number) => z.number().int().min(min).max(max);

export const photoSchema = z.object({
  view: z.enum(JOB_VIEWS),
  contentType: z.enum(ACCEPTED_IMAGE_TYPES),
  size: z.number().int().positive().max(MAX_IMAGE_BYTES, 'Each photo must be 10 MB or less'),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const createJobSchema = z
  .object({
    name: z.string().trim().min(1, 'Give the piece a name').max(100),
    note: z.string().trim().max(1000).optional(),
    pieceType: z.enum(PIECE_TYPES),
    pieceLabel: z.string().trim().max(60).optional(),
    // Customer's overall size, if known. All optional.
    widthMm: mm(100, 5000).optional(),
    depthMm: mm(100, 5000).optional(),
    heightMm: mm(100, 3000).optional(),
    removeBackground: z.boolean(),
    photos: z.array(photoSchema).min(1).max(JOB_VIEWS.length),
  })
  .superRefine((v, ctx) => {
    const views = v.photos.map((p) => p.view);
    if (!views.includes('front')) ctx.addIssue({ code: 'custom', message: 'The main photo is required', path: ['photos'] });
    if (new Set(views).size !== views.length) ctx.addIssue({ code: 'custom', message: 'Each view only once', path: ['photos'] });
    for (const p of v.photos) {
      if (Math.min(p.width, p.height) < MIN_IMAGE_SHORT_SIDE) {
        ctx.addIssue({
          code: 'custom',
          message: `The ${p.view} photo is ${p.width}x${p.height} px; the short side must be at least ${MIN_IMAGE_SHORT_SIDE} px`,
          path: ['photos'],
        });
      }
    }
  });

export type CreateJobInput = z.infer<typeof createJobSchema>;

export const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  hoursSaved: z.number().min(0).max(100).optional(),
  comment: z.string().trim().max(2000).optional(),
});

export function extensionFor(contentType: (typeof ACCEPTED_IMAGE_TYPES)[number]): string {
  return { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[contentType];
}

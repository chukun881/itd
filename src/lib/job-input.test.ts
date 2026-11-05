import { describe, expect, it } from 'vitest';
import { createJobSchema } from './job-input';

const photo = (view: string, width = 1200, height = 1600) => ({ view, contentType: 'image/jpeg', size: 1_000_000, width, height });
const base = { name: 'Lounge chair', pieceType: 'lounge_chair', removeBackground: false, photos: [photo('front')] };

const errors = (input: unknown) => {
  const r = createJobSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe('createJobSchema', () => {
  it('accepts a job with no size at all', () => {
    expect(errors(base)).toEqual([]);
  });

  it('accepts a partial size, extra 45° views and a piece label', () => {
    expect(errors({
      ...base, heightMm: 780, pieceLabel: 'table', removeBackground: true,
      photos: [photo('front'), photo('left_front'), photo('back')],
    })).toEqual([]);
  });

  it('requires the main photo', () => {
    expect(errors({ ...base, photos: [photo('back')] })).toContain('The main photo is required');
  });

  it('rejects duplicate views', () => {
    expect(errors({ ...base, photos: [photo('front'), photo('front')] })).toContain('Each view only once');
  });

  it('accepts 512 px online photos and rejects smaller ones', () => {
    expect(errors({ ...base, photos: [photo('front', 512, 600)] })).toEqual([]);
    expect(errors({ ...base, photos: [photo('front', 400, 501)] })[0]).toMatch(/at least 512 px/);
  });

  it('rejects an unknown piece type and sizes outside furniture range', () => {
    expect(errors({ ...base, pieceType: 'lamp' }).length).toBeGreaterThan(0);
    expect(errors({ ...base, widthMm: 5 }).length).toBeGreaterThan(0);
  });
});

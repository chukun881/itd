import { describe, expect, it } from 'vitest';
import { createJobSchema } from './job-input';

const photo = (view: string, width = 1200, height = 1600) => ({ view, contentType: 'image/jpeg', size: 1_000_000, width, height });
const base = { name: 'Lounge chair', widthMm: 800, depthMm: 850, heightMm: 780, removeBackground: false, photos: [photo('front')] };

const errors = (input: unknown) => {
  const r = createJobSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe('createJobSchema', () => {
  it('accepts a valid job with optional views and measurements', () => {
    expect(errors({ ...base, seatHeightMm: 420, armHeightMm: 600, photos: [photo('front'), photo('back')] })).toEqual([]);
  });

  it('requires a front photo', () => {
    expect(errors({ ...base, photos: [photo('back')] })).toContain('A front photo is required');
  });

  it('rejects duplicate views', () => {
    expect(errors({ ...base, photos: [photo('front'), photo('front')] })).toContain('Each view only once');
  });

  it('rejects photos below the minimum resolution', () => {
    expect(errors({ ...base, photos: [photo('front', 399, 501)] })[0]).toMatch(/at least 768 px/);
  });

  it('rejects a seat height above the total height', () => {
    expect(errors({ ...base, seatHeightMm: 900 })[0]).toMatch(/lower than the total height/);
  });

  it('rejects sizes outside furniture range', () => {
    expect(errors({ ...base, widthMm: 5 }).length).toBeGreaterThan(0);
  });
});

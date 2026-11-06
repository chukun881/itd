import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TriMesh, bounds, faceCount, readGlb, simplify, weld, writeGlb, writeObj, writeStl } from './mesh';
import { sizeMesh, stretchToSize, symmetrize, symmetryError } from './furniture';

/** Axis-aligned box from (x0,y0,z0) to (x1,y1,z1), 12 outward-facing triangles. */
function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): TriMesh {
  const v = [
    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
  ];
  const f = [
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4,
    3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5,
  ];
  return { positions: new Float32Array(v.flat()), indices: new Uint32Array(f) };
}

function merge(...meshes: TriMesh[]): TriMesh {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const m of meshes) {
    const base = positions.length / 3;
    positions.push(...m.positions);
    indices.push(...Array.from(m.indices, (i) => i + base));
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}

describe('stretchToSize', () => {
  it('scales each axis to the real size, base on the floor, centred', () => {
    const mesh = box(0, 0, 0, 1, 2, 1);
    const result = stretchToSize(mesh, 500, 600, 900);
    const b = bounds(mesh);
    expect(b.size.map((s) => Math.round(s))).toEqual([500, 900, 600]);
    expect(b.min[1]).toBeCloseTo(0);
    expect(b.min[0]).toBeCloseTo(-250);
    // height-only scale would be 450x; width needs 500 -> +11.1%, depth 600 -> +33.3%
    expect(result.stretchWidth).toBeCloseTo(500 / 450 - 1, 5);
    expect(result.stretchDepth).toBeCloseTo(600 / 450 - 1, 5);
  });
});

describe('symmetry', () => {
  it('scores a mirror-symmetric piece as symmetric and an L-shape as not', () => {
    const symmetric = merge(box(-1, 0, 0, -0.8, 1, 0.2), box(0.8, 0, 0, 1, 1, 0.2), box(-1, 1, 0, 1, 1.1, 1));
    const lShape = merge(box(-1, 0, 0, 1, 0.5, 0.5), box(-1, 0, 0.5, -0.5, 0.5, 2));
    // Boxes have very few vertices, so compare the two scores rather than the
    // absolute threshold (the threshold is checked on the real chair below).
    expect(symmetryError(symmetric)).toBeLessThan(0.002);
    expect(symmetryError(lShape)).toBeGreaterThan(0.01);
  });

  it('cuts at the centre plane so a closed piece stays closed (no seam gap)', () => {
    const sym = symmetrize(box(-1, 0, 0, 1.4, 1, 1)); // closed box, off-centre
    const edges = new Map<string, number>();
    for (let t = 0; t < sym.indices.length; t += 3) {
      for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
        const i = sym.indices[t + a], j = sym.indices[t + b];
        const k = i < j ? `${i},${j}` : `${j},${i}`;
        edges.set(k, (edges.get(k) ?? 0) + 1);
      }
    }
    expect([...edges.values()].filter((c) => c === 1)).toHaveLength(0);
  });

  it('mirrors the +X half and keeps the width', () => {
    const lopsided = merge(box(-1, 0, 0, -0.7, 1, 1), box(0.8, 0, 0, 1, 1, 1));
    const sym = symmetrize(lopsided);
    const b = bounds(sym);
    expect(b.min[0]).toBeCloseTo(-b.max[0]);
    expect(faceCount(sym)).toBe(24); // the 12 +X faces and their mirror
  });
});

describe('sizeMesh', () => {
  const typicalHeightMm = 850;

  it('stretches to all three customer sizes', () => {
    const r = sizeMesh(box(0, 0, 0, 1, 2, 1), { widthMm: 500, depthMm: 600, heightMm: 900, typicalHeightMm });
    expect(r).toMatchObject({ mode: 'stretched', widthMm: 500, depthMm: 600, heightMm: 900 });
    expect(r.stretchWidthPct).toBeCloseTo(11.1, 1);
  });

  it('scales evenly from the height when only the height is given', () => {
    const mesh = box(0, 0, 0, 1, 2, 1);
    const r = sizeMesh(mesh, { heightMm: 900, typicalHeightMm });
    expect(r).toMatchObject({ mode: 'scaled', widthMm: 450, depthMm: 450, heightMm: 900 });
    expect(r.stretchWidthPct).toBeUndefined();
    expect(bounds(mesh).min[1]).toBeCloseTo(0);
  });

  it('scales evenly from the width when height is missing', () => {
    const r = sizeMesh(box(0, 0, 0, 1, 2, 1), { widthMm: 500, depthMm: 999, typicalHeightMm });
    expect(r).toMatchObject({ mode: 'scaled', widthMm: 500, heightMm: 1000 });
  });

  it('uses the typical height when no size is given', () => {
    const r = sizeMesh(box(0, 0, 0, 1, 2, 1), { typicalHeightMm });
    expect(r).toMatchObject({ mode: 'typical', heightMm: 850, widthMm: 425 });
  });
});

describe('exporters', () => {
  it('writes STL, OBJ and GLB that round-trip', async () => {
    const mesh = box(0, 0, 0, 100, 200, 300);
    const stl = writeStl(mesh);
    expect(stl.byteLength).toBe(84 + 12 * 50);
    expect(new DataView(stl.buffer).getUint32(80, true)).toBe(12);
    const obj = new TextDecoder().decode(writeObj(mesh));
    expect(obj.match(/^v /gm)).toHaveLength(8);
    expect(obj.match(/^f /gm)).toHaveLength(12);
    const back = await readGlb(await writeGlb(mesh));
    expect(faceCount(back)).toBe(12);
    expect(bounds(back).size[1]).toBeCloseTo(0.2); // mm -> metres
  });
});

// Real AI output from the quality test, if it exists locally (not committed).
const REAL_CHAIR = 'fal-test-output/chair__hunyuan-pro.glb';
describe.skipIf(!fs.existsSync(REAL_CHAIR))('real chair GLB', () => {
  it('matches the Python pilot results', async () => {
    const raw = weld(await readGlb(new Uint8Array(fs.readFileSync(REAL_CHAIR))));
    const mesh = await simplify(raw, 50000);
    expect(faceCount(mesh)).toBeLessThanOrEqual(50000);
    expect(symmetryError(mesh)).toBeLessThan(0.02); // Python: 0.0034-0.0038
    const sym = symmetrize(mesh);
    const stretch = stretchToSize(sym, 490, 550, 850);
    expect(Math.abs(stretch.stretchWidth)).toBeLessThan(0.02); // Python: 0.2-0.4%
  }, 60000);
});

import { TriMesh, bounds } from './mesh';
import type { SizeMode } from '@/lib/shared';

/** Mean left/right mirror mismatch above which a piece is treated as asymmetric. */
export const SYMMETRY_MAX_ERROR = 0.02;
export { STRETCH_WARN } from '@/lib/shared';

/**
 * How far the mesh is from left/right (X) mirror symmetry: mean distance from each
 * mirrored sample vertex to the nearest vertex, divided by the largest size.
 */
export function symmetryError(mesh: TriMesh, samples = 4000): number {
  const { min, max, size } = bounds(mesh);
  const cx = (min[0] + max[0]) / 2, cy = (min[1] + max[1]) / 2, cz = (min[2] + max[2]) / 2;
  const scale = Math.max(...size);
  const count = mesh.positions.length / 3;
  const cell = scale / 40;
  const grid = new Map<string, number[]>();
  const key = (x: number, y: number, z: number) =>
    `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;

  for (let i = 0; i < count; i++) {
    const x = mesh.positions[i * 3] - cx, y = mesh.positions[i * 3 + 1] - cy, z = mesh.positions[i * 3 + 2] - cz;
    const k = key(x, y, z);
    const list = grid.get(k);
    if (list) list.push(i); else grid.set(k, [i]);
  }

  const step = Math.max(1, Math.floor(count / samples));
  let total = 0, n = 0;
  for (let i = 0; i < count; i += step) {
    const x = -(mesh.positions[i * 3] - cx), y = mesh.positions[i * 3 + 1] - cy, z = mesh.positions[i * 3 + 2] - cz;
    const gx = Math.floor(x / cell), gy = Math.floor(y / cell), gz = Math.floor(z / cell);
    let best = 1.5 * cell; // cap when nothing is close
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      for (const j of grid.get(`${gx + dx},${gy + dy},${gz + dz}`) ?? []) {
        const d = Math.hypot(
          mesh.positions[j * 3] - cx - x,
          mesh.positions[j * 3 + 1] - cy - y,
          mesh.positions[j * 3 + 2] - cz - z,
        );
        if (d < best) best = d;
      }
    }
    total += best;
    n++;
  }
  return total / n / scale;
}

/**
 * Keep the +X half and mirror it onto -X. Triangles are assigned by centroid, so
 * the seam at X=0 is slightly ragged; fine for a reference mesh.
 */
export function symmetrize(mesh: TriMesh): TriMesh {
  const { min, max } = bounds(mesh);
  const cx = (min[0] + max[0]) / 2;
  const p = mesh.positions;
  const kept: number[] = [];
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const a = mesh.indices[t], b = mesh.indices[t + 1], c = mesh.indices[t + 2];
    if ((p[a * 3] + p[b * 3] + p[c * 3]) / 3 >= cx) kept.push(a, b, c);
  }
  const vCount = p.length / 3;
  const positions = new Float32Array(p.length * 2);
  for (let i = 0; i < vCount; i++) {
    const x = p[i * 3] - cx;
    positions.set([x, p[i * 3 + 1], p[i * 3 + 2]], i * 3);
    positions.set([-x, p[i * 3 + 1], p[i * 3 + 2]], (vCount + i) * 3);
  }
  const indices = new Uint32Array(kept.length * 2);
  indices.set(kept);
  for (let t = 0; t < kept.length; t += 3) {
    // Mirroring flips orientation, so reverse the winding to keep normals outward.
    indices[kept.length + t] = vCount + kept[t];
    indices[kept.length + t + 1] = vCount + kept[t + 2];
    indices[kept.length + t + 2] = vCount + kept[t + 1];
  }
  return { positions, indices };
}

export interface StretchResult {
  stretchWidth: number; // fraction, relative to a height-only uniform scale
  stretchDepth: number;
}

/**
 * Scale each axis so the mesh is exactly W x H x D (mm), base on Y=0, centred on X/Z.
 * Mutates `mesh.positions`.
 */
export function stretchToSize(mesh: TriMesh, widthMm: number, depthMm: number, heightMm: number): StretchResult {
  const { min, size } = bounds(mesh);
  const sx = widthMm / size[0], sy = heightMm / size[1], sz = depthMm / size[2];
  const p = mesh.positions;
  for (let i = 0; i < p.length; i += 3) {
    p[i] = (p[i] - min[0]) * sx - widthMm / 2;
    p[i + 1] = (p[i + 1] - min[1]) * sy;
    p[i + 2] = (p[i + 2] - min[2]) * sz - depthMm / 2;
  }
  return { stretchWidth: sx / sy - 1, stretchDepth: sz / sy - 1 };
}

/** Scale evenly so `axis` (0 = X width, 1 = Y height, 2 = Z depth) is `mm` long; base on Y=0, centred on X/Z. */
export function scaleUniform(mesh: TriMesh, axis: 0 | 1 | 2, mm: number): void {
  const { min, max, size } = bounds(mesh);
  const k = mm / size[axis];
  const cx = (min[0] + max[0]) / 2, cz = (min[2] + max[2]) / 2;
  const p = mesh.positions;
  for (let i = 0; i < p.length; i += 3) {
    p[i] = (p[i] - cx) * k;
    p[i + 1] = (p[i + 1] - min[1]) * k;
    p[i + 2] = (p[i + 2] - cz) * k;
  }
}

export interface SizeInput {
  widthMm?: number | null;
  depthMm?: number | null;
  heightMm?: number | null;
  typicalHeightMm: number;
}

export interface SizeResult {
  mode: SizeMode;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  stretchWidthPct?: number;
  stretchDepthPct?: number;
}

/**
 * Size the mesh in mm. All three sizes: stretch each axis. One or two: scale evenly
 * from height, else width, else depth (never distort). None: scale evenly to the
 * typical height of the piece type. Mutates `mesh.positions`.
 */
export function sizeMesh(mesh: TriMesh, input: SizeInput): SizeResult {
  const { widthMm: w, depthMm: d, heightMm: h } = input;
  let mode: SizeMode;
  let stretch: StretchResult | undefined;
  if (w && d && h) {
    mode = 'stretched';
    stretch = stretchToSize(mesh, w, d, h);
  } else if (h || w || d) {
    mode = 'scaled';
    if (h) scaleUniform(mesh, 1, h); else if (w) scaleUniform(mesh, 0, w); else scaleUniform(mesh, 2, d!);
  } else {
    mode = 'typical';
    scaleUniform(mesh, 1, input.typicalHeightMm);
  }
  const { size } = bounds(mesh);
  const pct = (x: number) => Math.round(x * 1000) / 10;
  return {
    mode,
    widthMm: Math.round(size[0]),
    depthMm: Math.round(size[2]),
    heightMm: Math.round(size[1]),
    ...(stretch ? { stretchWidthPct: pct(stretch.stretchWidth), stretchDepthPct: pct(stretch.stretchDepth) } : {}),
  };
}

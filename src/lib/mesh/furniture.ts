import { TriMesh, bounds } from './mesh';

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

/** Heights (mm) of flat upward-facing surfaces, largest area first. */
export function upwardSurfaceHeights(mesh: TriMesh, binMm = 10): number[] {
  const p = mesh.positions;
  const totals = new Map<number, number>();
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const a = mesh.indices[t] * 3, b = mesh.indices[t + 1] * 3, c = mesh.indices[t + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len === 0 || ny / len <= 0.9) continue;
    const y = (p[a + 1] + p[b + 1] + p[c + 1]) / 3;
    const bin = Math.floor(y / binMm);
    totals.set(bin, (totals.get(bin) ?? 0) + len / 2);
  }
  return [...totals.entries()].sort((x, y) => y[1] - x[1]).map(([bin]) => (bin + 0.5) * binMm);
}

export interface MeasurementChecks {
  seatEstimateMm?: number;
  seatErrorMm?: number;
  armEstimateMm?: number;
  armErrorMm?: number;
}

/** Estimate seat/arm heights from flat upward surfaces and compare with the real values. */
export function checkMeasurements(mesh: TriMesh, heightMm: number, seatMm?: number | null, armMm?: number | null): MeasurementChecks {
  const candidates = upwardSurfaceHeights(mesh).filter((y) => y > 0.05 * heightMm && y < 0.95 * heightMm);
  const result: MeasurementChecks = {};
  const closest = (list: number[], target: number) =>
    list.reduce((best, y) => (Math.abs(y - target) < Math.abs(best - target) ? y : best));
  if (seatMm && candidates.length) {
    const est = closest(candidates.slice(0, 5), seatMm);
    result.seatEstimateMm = Math.round(est);
    result.seatErrorMm = Math.round(est - seatMm);
  }
  if (armMm && candidates.length) {
    const above = candidates.slice(0, 8).filter((y) => y > (seatMm ?? 0) + 50);
    if (above.length) {
      const est = closest(above, armMm);
      result.armEstimateMm = Math.round(est);
      result.armErrorMm = Math.round(est - armMm);
    }
  }
  return result;
}

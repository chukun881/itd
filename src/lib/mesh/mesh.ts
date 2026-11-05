import { Document, NodeIO } from '@gltf-transform/core';
import { MeshoptSimplifier } from 'meshoptimizer';

/**
 * Indexed triangle mesh. Positions are xyz triplets; Y is up, X is width,
 * Z is depth (glTF convention).
 */
export interface TriMesh {
  positions: Float32Array;
  indices: Uint32Array;
}

/** Read every triangle primitive of a GLB into one mesh, with node transforms applied. */
export async function readGlb(glb: Uint8Array): Promise<TriMesh> {
  const doc = await new NodeIO().readBinary(glb);
  const positions: number[] = [];
  const indices: number[] = [];

  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      if (prim.getMode() !== 4) continue; // triangles only
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const base = positions.length / 3;
      const p = [0, 0, 0];
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, p);
        positions.push(
          m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
          m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
          m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
        );
      }
      const idx = prim.getIndices();
      if (idx) {
        for (let i = 0; i < idx.getCount(); i++) indices.push(base + idx.getScalar(i));
      } else {
        for (let i = 0; i < pos.getCount(); i++) indices.push(base + i);
      }
    }
  }
  if (indices.length === 0) throw new Error('GLB contains no triangles');
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}

/** Merge vertices that share a position (GLB files split them along UV/normal seams). */
export function weld(mesh: TriMesh, tolerance = 1e-6): TriMesh {
  const map = new Map<string, number>();
  const remap = new Uint32Array(mesh.positions.length / 3);
  const out: number[] = [];
  const q = 1 / tolerance;
  for (let i = 0; i < remap.length; i++) {
    const x = mesh.positions[i * 3], y = mesh.positions[i * 3 + 1], z = mesh.positions[i * 3 + 2];
    const key = `${Math.round(x * q)},${Math.round(y * q)},${Math.round(z * q)}`;
    let id = map.get(key);
    if (id === undefined) {
      id = out.length / 3;
      map.set(key, id);
      out.push(x, y, z);
    }
    remap[i] = id;
  }
  const indices = new Uint32Array(mesh.indices.length);
  for (let i = 0; i < indices.length; i++) indices[i] = remap[mesh.indices[i]];
  return dropDegenerate({ positions: new Float32Array(out), indices });
}

function dropDegenerate(mesh: TriMesh): TriMesh {
  const keep: number[] = [];
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const a = mesh.indices[t], b = mesh.indices[t + 1], c = mesh.indices[t + 2];
    if (a !== b && b !== c && a !== c) keep.push(a, b, c);
  }
  return { positions: mesh.positions, indices: new Uint32Array(keep) };
}

/** Remove vertices no triangle uses. */
export function compact(mesh: TriMesh): TriMesh {
  const remap = new Int32Array(mesh.positions.length / 3).fill(-1);
  const out: number[] = [];
  const indices = new Uint32Array(mesh.indices.length);
  for (let i = 0; i < mesh.indices.length; i++) {
    const v = mesh.indices[i];
    if (remap[v] === -1) {
      remap[v] = out.length / 3;
      out.push(mesh.positions[v * 3], mesh.positions[v * 3 + 1], mesh.positions[v * 3 + 2]);
    }
    indices[i] = remap[v];
  }
  return { positions: new Float32Array(out), indices };
}

/** Reduce to about `targetFaces` triangles with meshoptimizer. */
export async function simplify(mesh: TriMesh, targetFaces: number): Promise<TriMesh> {
  if (mesh.indices.length / 3 <= targetFaces) return mesh;
  await MeshoptSimplifier.ready;
  const [indices] = MeshoptSimplifier.simplify(mesh.indices, mesh.positions, 3, targetFaces * 3, 0.01);
  return compact({ positions: mesh.positions, indices });
}

export function faceCount(mesh: TriMesh): number {
  return mesh.indices.length / 3;
}

export function bounds(mesh: TriMesh): { min: number[]; max: number[]; size: number[] } {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < mesh.positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = mesh.positions[i + k];
      if (v < min[k]) min[k] = v;
      if (v > max[k]) max[k] = v;
    }
  }
  return { min, max, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] };
}

/** Write a GLB. `scale` converts the mesh units (mm) to glTF metres for viewers. */
export async function writeGlb(mesh: TriMesh, scale = 0.001): Promise<Uint8Array> {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scaled = new Float32Array(mesh.positions.length);
  for (let i = 0; i < scaled.length; i++) scaled[i] = mesh.positions[i] * scale;
  const position = doc.createAccessor().setType('VEC3').setArray(scaled).setBuffer(buffer);
  const indices = doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(mesh.indices)).setBuffer(buffer);
  const material = doc.createMaterial('clay').setBaseColorFactor([0.8, 0.8, 0.8, 1]).setRoughnessFactor(0.8);
  const prim = doc.createPrimitive().setAttribute('POSITION', position).setIndices(indices).setMaterial(material);
  const node = doc.createNode('model').setMesh(doc.createMesh('model').addPrimitive(prim));
  doc.createScene('scene').addChild(node);
  return new NodeIO().writeBinary(doc);
}

/** Binary STL in mesh units (mm). */
export function writeStl(mesh: TriMesh): Uint8Array {
  const n = faceCount(mesh);
  const out = new ArrayBuffer(84 + n * 50);
  const view = new DataView(out);
  const header = 'furniture reference mesh, units: mm';
  for (let i = 0; i < header.length; i++) view.setUint8(i, header.charCodeAt(i));
  view.setUint32(80, n, true);
  const p = mesh.positions;
  let o = 84;
  for (let t = 0; t < n; t++) {
    const [a, b, c] = [mesh.indices[t * 3] * 3, mesh.indices[t * 3 + 1] * 3, mesh.indices[t * 3 + 2] * 3];
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    for (const v of [nx, ny, nz, p[a], p[a + 1], p[a + 2], p[b], p[b + 1], p[b + 2], p[c], p[c + 1], p[c + 2]]) {
      view.setFloat32(o, v, true);
      o += 4;
    }
    view.setUint16(o, 0, true);
    o += 2;
  }
  return new Uint8Array(out);
}

/** Wavefront OBJ in mesh units (mm). */
export function writeObj(mesh: TriMesh): Uint8Array {
  const lines = ['# furniture reference mesh, units: mm'];
  for (let i = 0; i < mesh.positions.length; i += 3) {
    lines.push(`v ${mesh.positions[i].toFixed(2)} ${mesh.positions[i + 1].toFixed(2)} ${mesh.positions[i + 2].toFixed(2)}`);
  }
  for (let t = 0; t < mesh.indices.length; t += 3) {
    lines.push(`f ${mesh.indices[t] + 1} ${mesh.indices[t + 1] + 1} ${mesh.indices[t + 2] + 1}`);
  }
  return new TextEncoder().encode(lines.join('\n') + '\n');
}

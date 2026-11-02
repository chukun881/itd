import { NodeIO } from '@gltf-transform/core';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, simplify, draco } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

export interface CompressionResult {
  desktopGlb: Buffer;
  mobileGlb: Buffer;
  desktopPolyCount: number;
  mobilePolyCount: number;
  rawPolyCount: number;
}

/**
 * Two-pass 3D model compression and decimation pipeline.
 * Reduces mesh complexity and applies Draco / Meshopt compression
 * to ensure models load at >=30 FPS without crashing mobile WebGL contexts.
 */
export async function optimizeGlb(rawGlbBuffer: Buffer): Promise<CompressionResult> {
  await MeshoptSimplifier.ready;

  const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);
  const doc = await io.readBinary(new Uint8Array(rawGlbBuffer));

  // Count initial raw triangles
  let rawPolyCount = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices();
      if (indices) {
        rawPolyCount += indices.getCount() / 3;
      }
    }
  }

  // Pass 1: Desktop Variant (50% decimation, 14-bit position quantization)
  const desktopDoc = await io.readBinary(new Uint8Array(rawGlbBuffer));
  await desktopDoc.transform(
    dedup(),
    prune(),
    simplify({ simplifier: MeshoptSimplifier, ratio: 0.5 }),
    draco({ method: 'edgebreaker', quantizePosition: 14, quantizeNormal: 10 })
  );

  let desktopPolyCount = 0;
  for (const mesh of desktopDoc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices();
      if (indices) {
        desktopPolyCount += indices.getCount() / 3;
      }
    }
  }
  const desktopGlb = Buffer.from(await io.writeBinary(desktopDoc));

  // Pass 2: Mobile Variant (85% decimation, 12-bit position quantization)
  const mobileDoc = await io.readBinary(new Uint8Array(rawGlbBuffer));
  await mobileDoc.transform(
    dedup(),
    prune(),
    simplify({ simplifier: MeshoptSimplifier, ratio: 0.15 }),
    draco({ method: 'edgebreaker', quantizePosition: 12, quantizeNormal: 8 })
  );

  let mobilePolyCount = 0;
  for (const mesh of mobileDoc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices();
      if (indices) {
        mobilePolyCount += indices.getCount() / 3;
      }
    }
  }
  const mobileGlb = Buffer.from(await io.writeBinary(mobileDoc));

  return {
    desktopGlb,
    mobileGlb,
    desktopPolyCount: Math.round(desktopPolyCount),
    mobilePolyCount: Math.round(mobilePolyCount),
    rawPolyCount: Math.round(rawPolyCount),
  };
}

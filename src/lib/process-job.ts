import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { Job, JobMetrics, jobs } from '@/db/schema';
import { FalModelOutput, getModelResult, isFalMediaUrl } from '@/lib/fal';
import { jobKey, uploadToR2 } from '@/lib/r2';
import { faceCount, readGlb, simplify, weld, writeGlb, writeObj, writeStl } from '@/lib/mesh/mesh';
import {
  SYMMETRY_MAX_ERROR,
  checkMeasurements,
  stretchToSize,
  symmetrize,
  symmetryError,
} from '@/lib/mesh/furniture';

const TARGET_FACES = 50_000;

async function download(url: string): Promise<Uint8Array> {
  if (!isFalMediaUrl(url)) throw new Error(`Refusing to download from a non-fal URL: ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Turn the raw fal model into the deliverables: simplify, mirror (when the piece is
 * symmetric), stretch to the real size, check seat/arm heights, export
 * GLB/STL/OBJ + preview to R2, and mark the job completed. Runs after the webhook
 * has already answered fal. The job must already be in `processing`.
 */
export async function processJob(job: Job, output: FalModelOutput | null): Promise<void> {
  const started = Date.now();
  try {
    const result = output?.model_glb ? output : await getModelResult(job.providerTaskId!);
    if (!result.model_glb?.url) throw new Error('fal result has no model_glb');

    const rawGlb = await download(result.model_glb.url);
    await uploadToR2(jobKey(job.id, 'raw.glb'), rawGlb);

    let mesh = await simplify(weld(await readGlb(rawGlb)), TARGET_FACES);
    const symError = symmetryError(mesh);
    const symmetryApplied = symError <= SYMMETRY_MAX_ERROR;
    if (symmetryApplied) mesh = symmetrize(mesh);
    const stretch = stretchToSize(mesh, job.widthMm, job.depthMm, job.heightMm);
    const checks = checkMeasurements(mesh, job.heightMm, job.seatHeightMm, job.armHeightMm);

    const outputKeys = {
      glb: jobKey(job.id, 'model.glb'),
      stl: jobKey(job.id, 'model.stl'),
      obj: jobKey(job.id, 'model.obj'),
      ...(result.thumbnail?.url ? { preview: jobKey(job.id, 'preview.png') } : {}),
    };
    await Promise.all([
      uploadToR2(outputKeys.glb, await writeGlb(mesh), 'model/gltf-binary'),
      uploadToR2(outputKeys.stl, writeStl(mesh), 'model/stl'),
      uploadToR2(outputKeys.obj, writeObj(mesh), 'model/obj'),
      result.thumbnail?.url
        ? download(result.thumbnail.url).then((png) => uploadToR2(outputKeys.preview!, png, 'image/png'))
        : Promise.resolve(),
    ]);

    const metrics: JobMetrics = {
      faces: faceCount(mesh),
      symmetryApplied,
      symmetryError: Math.round(symError * 10000) / 10000,
      stretchWidthPct: Math.round(stretch.stretchWidth * 1000) / 10,
      stretchDepthPct: Math.round(stretch.stretchDepth * 1000) / 10,
      ...checks,
      processingSeconds: Math.round((Date.now() - started) / 1000),
    };

    await db
      .update(jobs)
      .set({ status: 'completed', rawModelKey: jobKey(job.id, 'raw.glb'), outputKeys, metrics, completedAt: new Date() })
      .where(and(eq(jobs.id, job.id), eq(jobs.status, 'processing')));
  } catch (err) {
    console.error(`processJob ${job.id} failed:`, err);
    await db
      .update(jobs)
      .set({ status: 'failed', errorMessage: err instanceof Error ? err.message : 'Processing failed' })
      .where(and(eq(jobs.id, job.id), eq(jobs.status, 'processing')));
  }
}

import { optimizeGlb } from '../../src/lib/compression';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

interface LambdaEvent {
  jobId: string;
  rawGlbKey: string;
  callbackUrl?: string;
}

export async function handler(event: LambdaEvent) {
  const { jobId, rawGlbKey, callbackUrl } = event;
  console.log(`[Compression Worker] Starting processing for job: ${jobId}`);

  // 1. Fetch raw GLB from R2
  const getObj = await r2.send(
    new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: rawGlbKey,
    })
  );

  const rawBytes = await getObj.Body?.transformToByteArray();
  if (!rawBytes) throw new Error('Failed to retrieve raw GLB bytes');

  // 2. Run two-pass decimation
  const result = await optimizeGlb(Buffer.from(rawBytes));

  // 3. Upload desktop & mobile variants
  const desktopKey = `processed-models/${jobId}.glb`;
  const mobileKey = `processed-models/${jobId}/mobile.glb`;

  await Promise.all([
    r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: desktopKey,
        Body: result.desktopGlb,
        ContentType: 'model/gltf-binary',
        CacheControl: 'public, max-age=31536000, immutable',
      })
    ),
    r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: mobileKey,
        Body: result.mobileGlb,
        ContentType: 'model/gltf-binary',
        CacheControl: 'public, max-age=31536000, immutable',
      })
    ),
  ]);

  // 4. Trigger internal callback if URL provided
  if (callbackUrl) {
    await fetch(callbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_API_SECRET || '',
      },
      body: JSON.stringify({
        jobId,
        desktopFileSize: result.desktopGlb.length,
        mobileFileSize: result.mobileGlb.length,
        desktopPolyCount: result.desktopPolyCount,
        mobilePolyCount: result.mobilePolyCount,
      }),
    });
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      jobId,
      desktopKey,
      mobileKey,
      desktopPolyCount: result.desktopPolyCount,
      mobilePolyCount: result.mobilePolyCount,
    }),
  };
}

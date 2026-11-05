// Side-by-side quality test of fal image-to-3D models. Each run is billable.
// Usage: node scripts/fal-quality-test.mjs <image-path-or-url>... [--yes]
// Without --yes it only prints the cost estimate.
import fs from 'node:fs';
import path from 'node:path';
import nextEnv from '@next/env';
import { createFalClient } from '@fal-ai/client';

nextEnv.loadEnvConfig(process.cwd());

// Prices from the fal model pages, checked 2026-11-05.
const MODELS = [
  { id: 'hunyuan-rapid', endpoint: 'fal-ai/hunyuan-3d/v3.1/rapid/image-to-3d', price: 0.225,
    input: (url) => ({ input_image_url: url }), output: (d) => d.model_glb },
  { id: 'hunyuan-pro', endpoint: 'fal-ai/hunyuan-3d/v3.1/pro/image-to-3d', price: 0.375,
    input: (url) => ({ input_image_url: url }), output: (d) => d.model_glb },
  { id: 'hunyuan-pro-pbr', endpoint: 'fal-ai/hunyuan-3d/v3.1/pro/image-to-3d', price: 0.525,
    input: (url) => ({ input_image_url: url, enable_pbr: true }), output: (d) => d.model_glb },
  { id: 'rodin', endpoint: 'fal-ai/hyper3d/rodin', price: 0.4,
    input: (url) => ({ input_image_urls: [url] }), output: (d) => d.model_mesh },
];

const args = process.argv.slice(2);
const confirmed = args.includes('--yes');
const images = args.filter((a) => a !== '--yes');

if (images.length === 0) {
  console.error('Usage: node scripts/fal-quality-test.mjs <image-path-or-url>... [--yes]');
  process.exit(1);
}

const total = images.length * MODELS.reduce((sum, m) => sum + m.price, 0);
console.log(`${images.length} image(s) x ${MODELS.length} models = estimated $${total.toFixed(2)}`);
if (!confirmed) {
  console.log('Dry run. Add --yes to spend the credits.');
  process.exit(0);
}
if (!process.env.FAL_KEY) {
  console.error('FAL_KEY is absent from .env.local');
  process.exit(1);
}

const fal = createFalClient({ credentials: process.env.FAL_KEY });
const outDir = path.join(process.cwd(), 'fal-test-output');
fs.mkdirSync(outDir, { recursive: true });
const report = [];

for (const image of images) {
  const name = path.basename(image).replace(/\.[^.]+$/, '');
  let url = image;
  if (!/^https?:\/\//.test(image)) {
    const buffer = fs.readFileSync(image);
    url = await fal.storage.upload(new Blob([buffer]));
  }

  // Models for one image run in parallel; a failure in one does not stop the others.
  await Promise.all(
    MODELS.map(async (model) => {
      const started = Date.now();
      try {
        const result = await fal.subscribe(model.endpoint, { input: model.input(url) });
        const file = model.output(result.data);
        const ext = path.extname(new URL(file.url).pathname) || '.glb';
        const target = path.join(outDir, `${name}__${model.id}${ext}`);
        const response = await fetch(file.url);
        fs.writeFileSync(target, Buffer.from(await response.arrayBuffer()));
        const row = {
          image: name, model: model.id, requestId: result.requestId,
          seconds: Math.round((Date.now() - started) / 1000),
          sizeMB: +(fs.statSync(target).size / 1e6).toFixed(1), format: ext, file: target,
        };
        report.push(row);
        console.log('OK  ', row.image, row.model, `${row.seconds}s`, `${row.sizeMB}MB`, row.format);
      } catch (err) {
        report.push({ image: name, model: model.id, error: String(err?.message ?? err) });
        console.log('FAIL', name, model.id, err?.status ?? '', err?.message ?? err);
      }
    }),
  );
}

fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(`Saved models and report.json to ${outDir}. View GLBs at https://gltf-viewer.donmccurdy.com/`);

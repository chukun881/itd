'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { JobView } from '@/lib/shared';
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES, MIN_IMAGE_SHORT_SIDE } from '@/lib/job-input';

interface Photo {
  file: File;
  width: number;
  height: number;
  preview: string;
}

const VIEWS: { view: JobView; label: string; hint: string }[] = [
  { view: 'front', label: 'Main photo (required)', hint: '3/4 view: front and one side' },
  { view: 'back', label: 'Back (optional)', hint: 'Straight from behind' },
  { view: 'left', label: 'Left side (optional)', hint: 'Straight from the left' },
  { view: 'right', label: 'Right side (optional)', hint: 'Straight from the right' },
];

const TIPS = [
  'Stand 2-3 m away and zoom 2x. Close-up wide photos bend the shape.',
  'Hold the camera at about half the height of the piece.',
  'The whole piece in the photo, filling most of it. Even light, no hard shadows.',
  'More views (back, sides) = more accurate model.',
];

function readImage(file: File): Promise<Photo> {
  return new Promise((resolve, reject) => {
    const preview = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ file, width: img.naturalWidth, height: img.naturalHeight, preview });
    img.onerror = () => reject(new Error('Could not read this image'));
    img.src = preview;
  });
}

const numberOrUndefined = (v: string) => (v.trim() === '' ? undefined : Number(v));

export function JobForm() {
  const router = useRouter();
  const [photos, setPhotos] = useState<Partial<Record<JobView, Photo>>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function pickPhoto(view: JobView, file?: File) {
    if (!file) return;
    if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) return toast.error('Use a JPG, PNG or WebP photo');
    if (file.size > MAX_IMAGE_BYTES) return toast.error('Photo is larger than 10 MB');
    try {
      const photo = await readImage(file);
      if (Math.min(photo.width, photo.height) < MIN_IMAGE_SHORT_SIDE) {
        return toast.error(`Photo is too small (${photo.width}x${photo.height} px). Use at least ${MIN_IMAGE_SHORT_SIDE} px on the short side.`);
      }
      setPhotos((p) => ({ ...p, [view]: photo }));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!photos.front) return toast.error('Add the main photo');
    const form = new FormData(e.currentTarget);
    const entries = Object.entries(photos) as [JobView, Photo][];

    try {
      setBusy('Creating job');
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.get('name'),
          note: form.get('note') || undefined,
          widthMm: Number(form.get('widthMm')),
          depthMm: Number(form.get('depthMm')),
          heightMm: Number(form.get('heightMm')),
          seatHeightMm: numberOrUndefined(String(form.get('seatHeightMm') ?? '')),
          armHeightMm: numberOrUndefined(String(form.get('armHeightMm') ?? '')),
          removeBackground: form.get('background') === 'busy',
          photos: entries.map(([view, p]) => ({ view, contentType: p.file.type, size: p.file.size, width: p.width, height: p.height })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not create the job');

      setBusy('Uploading photos');
      await Promise.all(
        (data.uploads as { view: JobView; url: string; contentType: string }[]).map(async (u) => {
          const put = await fetch(u.url, { method: 'PUT', headers: { 'Content-Type': u.contentType }, body: photos[u.view]!.file });
          if (!put.ok) throw new Error(`Upload of the ${u.view} photo failed`);
        }),
      );

      setBusy('Starting 3D generation');
      const submit = await fetch(`/api/jobs/${data.jobId}/submit`, { method: 'POST' });
      if (!submit.ok) throw new Error((await submit.json()).error ?? 'Could not start the job');

      router.push(`/jobs/${data.jobId}`);
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(null);
    }
  }

  const input = 'w-full rounded border border-neutral-300 px-3 py-2 text-sm';
  return (
    <form onSubmit={onSubmit} className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-8">
        <section className="space-y-3">
          <h2 className="font-medium">1. Photos</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {VIEWS.map(({ view, label, hint }) => (
              <label key={view} className="block cursor-pointer rounded-lg border border-dashed border-neutral-300 bg-white p-3 hover:border-neutral-500">
                <div className="text-sm font-medium">{label}</div>
                <div className="mb-2 text-xs text-neutral-500">{hint}</div>
                <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded bg-neutral-50">
                  {photos[view] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photos[view]!.preview} alt={view} className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-xs text-neutral-400">Click to choose a photo</span>
                  )}
                </div>
                <input type="file" accept={ACCEPTED_IMAGE_TYPES.join(',')} className="hidden" onChange={(e) => pickPhoto(view, e.target.files?.[0])} />
              </label>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-medium">2. Background</h2>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="background" value="clean" defaultChecked className="mt-1" />
            <span>Clean background (plain wall or floor, nothing else touching the piece)</span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="background" value="busy" className="mt-1" />
            <span>Busy background: remove it for me. <span className="text-neutral-500">Extra cost; results may be less accurate than a clean photo.</span></span>
          </label>
        </section>

        <section className="space-y-3">
          <h2 className="font-medium">3. Piece details (mm)</h2>
          <input name="name" required maxLength={100} placeholder="Name, e.g. Lounge chair Oslo" className={input} />
          <div className="grid grid-cols-3 gap-3">
            <input name="widthMm" type="number" required min={100} max={5000} placeholder="Width" className={input} />
            <input name="depthMm" type="number" required min={100} max={5000} placeholder="Depth" className={input} />
            <input name="heightMm" type="number" required min={100} max={3000} placeholder="Height" className={input} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input name="seatHeightMm" type="number" min={50} max={2000} placeholder="Seat height (optional)" className={input} />
            <input name="armHeightMm" type="number" min={50} max={2000} placeholder="Arm height (optional)" className={input} />
          </div>
          <textarea name="note" maxLength={1000} rows={3} placeholder="Note (optional)" className={input} />
        </section>

        <button disabled={!!busy} className="rounded bg-neutral-900 px-5 py-2.5 text-sm text-white hover:bg-neutral-700 disabled:opacity-50">
          {busy ? `${busy}...` : 'Generate 3D model'}
        </button>
      </div>

      <aside className="h-fit rounded-lg border border-neutral-200 bg-white p-4 text-sm">
        <h3 className="mb-2 font-medium">Photo tips for accuracy</h3>
        <ul className="list-disc space-y-1.5 pl-4 text-neutral-600">
          {TIPS.map((t) => <li key={t}>{t}</li>)}
        </ul>
        <p className="mt-4 text-xs text-neutral-500">
          The result is a real-size reference mesh to trace over in Inventor, not a finished production model.
        </p>
      </aside>
    </form>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PIECE_TYPES, PIECE_TYPE_INFO, type JobView } from '@/lib/shared';
import { ACCEPTED_IMAGE_TYPES, GOOD_IMAGE_SHORT_SIDE, MAX_IMAGE_BYTES, MIN_IMAGE_SHORT_SIDE } from '@/lib/job-input';

interface Photo {
  file: File;
  width: number;
  height: number;
  preview: string;
}

const MAIN: { view: JobView; label: string; hint: string } = {
  view: 'front', label: 'Main photo (required)', hint: 'Front or 3/4 view. An online photo or a design picture is fine.',
};
const EXTRA: { view: JobView; label: string; hint: string }[] = [
  { view: 'left_front', label: 'Front-left 45°', hint: 'Front and left side visible' },
  { view: 'right_front', label: 'Front-right 45°', hint: 'Front and right side visible' },
  { view: 'left', label: 'Left side', hint: 'Straight from the left' },
  { view: 'right', label: 'Right side', hint: 'Straight from the right' },
  { view: 'back', label: 'Back', hint: 'Straight from behind' },
];

const TIPS = [
  'If the listing has more photos of the same piece, add them below. Real extra photos help most.',
  'Pick the largest, sharpest version of the photo.',
  'Whole piece visible, not cut off at the edges.',
  'Photo of a set (table and chairs)? Choose "busy background" and say which piece you want.',
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
  const [busyBackground, setBusyBackground] = useState(false);

  async function pickPhoto(view: JobView, file?: File) {
    if (!file) return;
    if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) return toast.error('Use a JPG, PNG or WebP photo');
    if (file.size > MAX_IMAGE_BYTES) return toast.error('Photo is larger than 10 MB');
    try {
      const photo = await readImage(file);
      if (Math.min(photo.width, photo.height) < MIN_IMAGE_SHORT_SIDE) {
        return toast.error(`Photo is too small (${photo.width}x${photo.height} px). Use at least ${MIN_IMAGE_SHORT_SIDE} px on the short side.`);
      }
      if (Math.min(photo.width, photo.height) < GOOD_IMAGE_SHORT_SIDE) {
        toast.warning(`Small photo (${photo.width}x${photo.height} px): the draft will be rougher.`);
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
          pieceType: form.get('pieceType'),
          pieceLabel: busyBackground ? String(form.get('pieceLabel') ?? '').trim() || undefined : undefined,
          widthMm: numberOrUndefined(String(form.get('widthMm') ?? '')),
          depthMm: numberOrUndefined(String(form.get('depthMm') ?? '')),
          heightMm: numberOrUndefined(String(form.get('heightMm') ?? '')),
          removeBackground: busyBackground,
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
  const slot = ({ view, label, hint }: { view: JobView; label: string; hint: string }) => (
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
  );
  return (
    <form onSubmit={onSubmit} className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-8">
        <section className="space-y-3">
          <h2 className="font-medium">1. Photos</h2>
          <div className="max-w-md">{slot(MAIN)}</div>
          <details className="rounded-lg border border-neutral-200 bg-white p-3" open={Object.keys(photos).length > 1}>
            <summary className="cursor-pointer text-sm font-medium">More photos of the same piece (optional)</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">{EXTRA.map(slot)}</div>
          </details>
        </section>

        <section className="space-y-3">
          <h2 className="font-medium">2. Background</h2>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="background" value="clean" checked={!busyBackground} onChange={() => setBusyBackground(false)} className="mt-1" />
            <span>Clean background (plain white or plain wall, only this piece)</span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="background" value="busy" checked={busyBackground} onChange={() => setBusyBackground(true)} className="mt-1" />
            <span>Busy background or several pieces: cut out the piece for me. <span className="text-neutral-500">Extra cost.</span></span>
          </label>
          {busyBackground && (
            <input name="pieceLabel" maxLength={60} placeholder='Which piece? e.g. "table", "armchair on the left"' className={input} />
          )}
        </section>

        <section className="space-y-3">
          <h2 className="font-medium">3. Piece</h2>
          <input name="name" required maxLength={100} placeholder="Name, e.g. Lounge chair Oslo" className={input} />
          <select name="pieceType" required defaultValue="dining_chair" className={input}>
            {PIECE_TYPES.map((t) => (
              <option key={t} value={t}>{PIECE_TYPE_INFO[t].label} (typical height {PIECE_TYPE_INFO[t].defaultHeightMm} mm)</option>
            ))}
          </select>
          <div>
            <div className="mb-1 text-xs text-neutral-500">Overall size in mm, if the customer gave one. Leave empty if unknown: the draft is scaled to the typical height and you adjust it in Inventor.</div>
            <div className="grid grid-cols-3 gap-3">
              <input name="widthMm" type="number" min={100} max={5000} placeholder="Width" className={input} />
              <input name="depthMm" type="number" min={100} max={5000} placeholder="Depth" className={input} />
              <input name="heightMm" type="number" min={100} max={3000} placeholder="Height" className={input} />
            </div>
          </div>
          <textarea name="note" maxLength={1000} rows={3} placeholder="Note (optional)" className={input} />
        </section>

        <button disabled={!!busy} className="rounded bg-neutral-900 px-5 py-2.5 text-sm text-white hover:bg-neutral-700 disabled:opacity-50">
          {busy ? `${busy}...` : 'Generate 3D model'}
        </button>
      </div>

      <aside className="h-fit rounded-lg border border-neutral-200 bg-white p-4 text-sm">
        <h3 className="mb-2 font-medium">Tips</h3>
        <ul className="list-disc space-y-1.5 pl-4 text-neutral-600">
          {TIPS.map((t) => <li key={t}>{t}</li>)}
        </ul>
        <p className="mt-4 text-xs text-neutral-500">
          The result is a 3D draft (STEP, STL, OBJ) to refine in Inventor: overall shape and proportions,
          not final details like cushion thickness, timber sizes or radii.
        </p>
      </aside>
    </form>
  );
}

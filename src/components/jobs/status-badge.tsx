import type { Job } from '@/db/schema';

const LABELS: Partial<Record<Job['status'], [string, string]>> = {
  pending: ['Waiting for photos', 'bg-neutral-100 text-neutral-700'],
  submitted: ['Generating 3D (about 3 min)', 'bg-blue-50 text-blue-700'],
  processing: ['Preparing files', 'bg-blue-50 text-blue-700'],
  completed: ['Ready', 'bg-green-50 text-green-700'],
  failed: ['Failed', 'bg-red-50 text-red-700'],
};

export function StatusBadge({ status }: { status: Job['status'] }) {
  const [label, style] = LABELS[status] ?? [status, 'bg-neutral-100 text-neutral-700'];
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${style}`}>{label}</span>;
}

export function sizeLabel(job: Pick<Job, 'widthMm' | 'depthMm' | 'heightMm'>): string {
  return `${job.widthMm} x ${job.depthMm} x ${job.heightMm} mm`;
}

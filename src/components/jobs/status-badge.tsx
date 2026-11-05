import type { Job } from '@/db/schema';
import { PIECE_TYPE_INFO } from '@/lib/shared';

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

/** Piece type and size: the final model size once ready, else what the customer gave. */
export function sizeLabel(job: Pick<Job, 'pieceType' | 'widthMm' | 'depthMm' | 'heightMm' | 'metrics'>): string {
  const type = PIECE_TYPE_INFO[job.pieceType]?.label ?? job.pieceType;
  const m = job.metrics;
  if (m) return `${type} · ${m.widthMm} x ${m.depthMm} x ${m.heightMm} mm${m.sizeMode === 'typical' ? ' (typical height)' : ''}`;
  const given = [['W', job.widthMm], ['D', job.depthMm], ['H', job.heightMm]].filter(([, v]) => v).map(([k, v]) => `${k} ${v}`);
  return `${type} · ${given.length ? `${given.join(' ')} mm` : 'size not given'}`;
}

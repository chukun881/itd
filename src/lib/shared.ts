// Constants shared by server and browser code. Keep this file free of Node imports.

/**
 * Photo slots. `front` is the main photo (front or 3/4 view) and is required; the
 * others are extra photos of the same piece, e.g. from the same online listing.
 * Each maps to a Hunyuan 3D input field.
 */
export const JOB_VIEWS = ['front', 'left_front', 'right_front', 'left', 'right', 'back'] as const;
export type JobView = (typeof JOB_VIEWS)[number];

export const VIEW_LABELS: Record<JobView, string> = {
  front: 'Main photo',
  left_front: 'Front-left (45°)',
  right_front: 'Front-right (45°)',
  left: 'Left side',
  right: 'Right side',
  back: 'Back',
};

/** Piece types and the height used when the customer gave no size. */
export const PIECE_TYPES = ['dining_chair', 'lounge_chair', 'sofa', 'table', 'other'] as const;
export type PieceType = (typeof PIECE_TYPES)[number];

export const PIECE_TYPE_INFO: Record<PieceType, { label: string; defaultHeightMm: number }> = {
  dining_chair: { label: 'Dining chair', defaultHeightMm: 850 },
  lounge_chair: { label: 'Lounge chair', defaultHeightMm: 750 },
  sofa: { label: 'Sofa', defaultHeightMm: 850 },
  table: { label: 'Table', defaultHeightMm: 750 },
  other: { label: 'Other', defaultHeightMm: 800 },
};

/**
 * How the model was sized:
 * - stretched: all three customer sizes given, each axis scaled to fit
 * - scaled: one or two sizes given, scaled evenly from the first of height, width, depth
 * - typical: no size given, scaled evenly to the typical height of the piece type
 */
export type SizeMode = 'stretched' | 'scaled' | 'typical';

/** Stretch on any axis above this is reported as a warning. */
export const STRETCH_WARN = 0.1;

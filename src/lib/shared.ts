// Constants shared by server and browser code. Keep this file free of Node imports.

export const JOB_VIEWS = ['front', 'back', 'left', 'right'] as const;
export type JobView = (typeof JOB_VIEWS)[number];

/** Stretch on any axis above this is reported as a warning. */
export const STRETCH_WARN = 0.1;

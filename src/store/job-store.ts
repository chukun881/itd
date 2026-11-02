import { create } from 'zustand';
import type { Job } from '@/db/schema';

interface JobState {
  /** Currently active job being tracked in real-time */
  activeJob: Job | null;

  /** Generation history for the dashboard */
  jobs: Job[];

  /** User's current credit balance */
  credits: number;

  /** Actions */
  setActiveJob: (job: Job | null) => void;
  updateActiveJobStatus: (status: Job['status']) => void;
  setJobs: (jobs: Job[]) => void;
  addJob: (job: Job) => void;
  setCredits: (credits: number) => void;
  decrementCredits: (amount: number) => void;
}

export const useJobStore = create<JobState>((set) => ({
  activeJob: null,
  jobs: [],
  credits: 0,

  setActiveJob: (job) => set({ activeJob: job }),

  updateActiveJobStatus: (status) =>
    set((state) => ({
      activeJob: state.activeJob ? { ...state.activeJob, status } : null,
    })),

  setJobs: (jobs) => set({ jobs }),

  addJob: (job) =>
    set((state) => ({
      jobs: [job, ...state.jobs],
    })),

  setCredits: (credits) => set({ credits }),

  decrementCredits: (amount) =>
    set((state) => ({
      credits: Math.max(0, state.credits - amount),
    })),
}));

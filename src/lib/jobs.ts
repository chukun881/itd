import { auth, currentUser } from '@clerk/nextjs/server';
import { and, eq, gte, ne, sql } from 'drizzle-orm';
import { db } from '@/db';
import { Job, JobView, jobs, users, User } from '@/db/schema';
import { env } from '@/env';
import { getPresignedGetUrl } from '@/lib/r2';

export interface Viewer {
  user: User;
  isAdmin: boolean;
}

export function isAdminEmail(email: string, adminEmails = env.ADMIN_EMAILS): boolean {
  const list = adminEmails.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}

/** The signed-in user, created in our database on first visit. Null if signed out. */
export async function getViewer(): Promise<Viewer | null> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  let [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!user) {
    const clerkUser = await currentUser();
    const email = clerkUser?.primaryEmailAddress?.emailAddress ?? clerkUser?.emailAddresses[0]?.emailAddress ?? '';
    const name = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ') || null;
    [user] = await db
      .insert(users)
      .values({ clerkId, email, name, imageUrl: clerkUser?.imageUrl ?? null })
      .onConflictDoUpdate({ target: users.clerkId, set: { updatedAt: new Date() } })
      .returning();
  }
  return { user, isAdmin: isAdminEmail(user.email) };
}

export function canAccessJob(job: Pick<Job, 'userId'>, viewer: Viewer): boolean {
  return viewer.isAdmin || job.userId === viewer.user.id;
}

/** Load a job the viewer may see, or null (also null when it belongs to someone else). */
export async function getAccessibleJob(jobId: string, viewer: Viewer): Promise<Job | null> {
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return null;
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  return job && canAccessJob(job, viewer) ? job : null;
}

/** Jobs a user started this calendar month (UTC), excluding never-submitted drafts. */
export async function jobsThisMonth(userId: string): Promise<number> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobs)
    .where(and(eq(jobs.userId, userId), gte(jobs.createdAt, monthStart), ne(jobs.status, 'pending')));
  return row?.count ?? 0;
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'model';
}

export interface JobFileUrls {
  inputs: Partial<Record<JobView, string>>;
  cutouts: Partial<Record<JobView, string>>;
  preview?: string;
  viewerGlb?: string;
  downloads: { glb?: string; stl?: string; obj?: string; step?: string };
}

/** Short-lived presigned URLs for every file of a job. */
export async function jobFileUrls(job: Job): Promise<JobFileUrls> {
  const sign = (key?: string, download?: string) => (key ? getPresignedGetUrl(key, 3600, download) : undefined);
  const base = safeName(job.name);
  const entries = async (map: Partial<Record<JobView, string>>) =>
    Object.fromEntries(await Promise.all(Object.entries(map).map(async ([v, k]) => [v, await sign(k)])));
  const o = job.outputKeys;
  return {
    inputs: await entries(job.inputKeys),
    cutouts: await entries(job.cutoutKeys),
    preview: await sign(o.preview),
    viewerGlb: await sign(o.glb),
    downloads: {
      glb: await sign(o.glb, `${base}.glb`),
      stl: await sign(o.stl, `${base}.stl`),
      obj: await sign(o.obj, `${base}.obj`),
      step: await sign(o.step, `${base}.step`),
    },
  };
}

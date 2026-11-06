import { notFound } from 'next/navigation';
import { getAccessibleJob, getViewer } from '@/lib/jobs';
import { JobDetail } from '@/components/jobs/job-detail';

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = (await getViewer())!;
  const job = await getAccessibleJob((await params).id, viewer);
  if (!job) notFound();
  return <JobDetail jobId={job.id} />;
}

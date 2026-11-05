import { JobForm } from '@/components/jobs/job-form';

export default function NewJobPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">New 3D model</h1>
      <JobForm />
    </div>
  );
}

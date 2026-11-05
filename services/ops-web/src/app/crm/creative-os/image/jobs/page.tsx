import { Suspense } from 'react';
import { CpImageJobs } from '@/components/crm/cp/CpImageJobs';

export default function ImageSopJobsPage() {
  return (
    <Suspense fallback={<p className="cp-muted">Đang tải…</p>}>
      <CpImageJobs />
    </Suspense>
  );
}

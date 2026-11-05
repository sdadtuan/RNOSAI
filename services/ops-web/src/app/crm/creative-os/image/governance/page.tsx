import { Suspense } from 'react';
import { CpImageGovernance } from '@/components/crm/cp/CpImageGovernance';

export default function ImageSopGovernancePage() {
  return (
    <Suspense fallback={<p className="cp-muted">Đang tải…</p>}>
      <CpImageGovernance />
    </Suspense>
  );
}

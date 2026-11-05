import { Suspense } from 'react';
import { CpBatchFactory } from '@/components/crm/cp/CpBatchFactory';

export default function CreativeOsVideoBatchPage() {
  return (
    <Suspense fallback={<p className="cp-muted">Đang tải…</p>}>
      <CpBatchFactory />
    </Suspense>
  );
}

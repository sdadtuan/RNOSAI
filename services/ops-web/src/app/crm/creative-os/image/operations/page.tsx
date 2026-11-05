import { Suspense } from 'react';
import { CpImageOperations } from '@/components/crm/cp/CpImageOperations';

export default function ImageSopOperationsPage() {
  return (
    <Suspense fallback={<p className="cp-muted">Đang tải…</p>}>
      <CpImageOperations />
    </Suspense>
  );
}

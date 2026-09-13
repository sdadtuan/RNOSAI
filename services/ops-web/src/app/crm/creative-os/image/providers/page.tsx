import { Suspense } from 'react';
import { CpImageProviders } from '@/components/crm/cp/CpImageProviders';

export default function ImageSopProvidersPage() {
  return (
    <Suspense fallback={<p className="cp-muted">Đang tải…</p>}>
      <CpImageProviders />
    </Suspense>
  );
}

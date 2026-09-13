import { Suspense } from 'react';
import { CpImageSops } from '@/components/crm/cp/CpImageSops';

export default function ImageSopRegistryPage() {
  return (
    <Suspense fallback={<p className="cp-muted">Đang tải…</p>}>
      <CpImageSops />
    </Suspense>
  );
}

import { Suspense } from 'react';
import { CpImageAssets } from '@/components/crm/cp/CpImageAssets';

export default function ImageSopAssetsPage() {
  return (
    <Suspense fallback={<p className="cp-muted">Đang tải…</p>}>
      <CpImageAssets />
    </Suspense>
  );
}

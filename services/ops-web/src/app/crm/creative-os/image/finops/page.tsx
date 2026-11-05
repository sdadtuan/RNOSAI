import { Suspense } from 'react';
import { CpImageFinops } from '@/components/crm/cp/CpImageFinops';

export default function ImageSopFinopsPage() {
  return (
    <Suspense fallback={<p className="cp-muted">Đang tải…</p>}>
      <CpImageFinops />
    </Suspense>
  );
}

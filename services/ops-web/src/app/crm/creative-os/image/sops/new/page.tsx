import { Suspense } from 'react';
import { CpImageComposer } from '@/components/crm/cp/CpImageComposer';

export default function ImageSopComposerPage() {
  return (
    <Suspense fallback={<p className="cp-muted">Đang tải…</p>}>
      <CpImageComposer />
    </Suspense>
  );
}

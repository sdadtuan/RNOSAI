import { Suspense } from 'react';
import { CpImageReview } from '@/components/crm/cp/CpImageReview';

export default function ImageSopReviewPage() {
  return (
    <Suspense fallback={<p className="cp-muted">Đang tải…</p>}>
      <CpImageReview />
    </Suspense>
  );
}

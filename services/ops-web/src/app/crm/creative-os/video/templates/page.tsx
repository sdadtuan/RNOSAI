import { Suspense } from 'react';
import { CpTemplates } from '@/components/crm/cp/CpTemplates';

export default function CreativeOsVideoTemplatesPage() {
  return (
    <Suspense fallback={<p className="cp-muted">Đang tải…</p>}>
      <CpTemplates />
    </Suspense>
  );
}

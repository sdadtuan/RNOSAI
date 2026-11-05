import { Suspense } from 'react';
import { CpVideoList } from '@/components/crm/cp/CpVideoList';

export default function CreativeOsVideoPage() {
  return <Suspense fallback={<p className="cp-muted">Đang tải…</p>}><CpVideoList /></Suspense>;
}

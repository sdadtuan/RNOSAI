import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { CpImageShell } from '@/components/crm/cp/CpImageShell';

export default function ImageSopLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<p className="cp-muted">Đang tải ImageOS…</p>}>
      <CpImageShell>{children}</CpImageShell>
    </Suspense>
  );
}

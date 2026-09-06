import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { AmShell } from '@/components/crm/am/AmShell';
import { RevOpsEmbedFrame } from '@/components/crm/revops/RevOpsEmbedFrame';
import './am.css';

export default function AmLayout({ children }: { children: ReactNode }) {
  return (
    <AmShell>
      <Suspense fallback={children}>
        <RevOpsEmbedFrame>{children}</RevOpsEmbedFrame>
      </Suspense>
    </AmShell>
  );
}

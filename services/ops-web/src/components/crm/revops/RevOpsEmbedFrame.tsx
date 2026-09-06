'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import '@/app/crm/revenue-ops/revops.css';

export function RevOpsEmbedFrame({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const embedded = searchParams.get('revops') === '1';

  useEffect(() => {
    if (!embedded) return;
    document.documentElement.classList.add('revops-embed');
    return () => {
      document.documentElement.classList.remove('revops-embed');
    };
  }, [embedded]);

  return <>{children}</>;
}

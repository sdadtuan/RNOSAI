import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { RevOpsShell } from '@/components/crm/revops/RevOpsShell';
import { isRevopsShellEnabled } from '@/lib/crm/revops-flags';
import './revops.css';

export default function RevenueOpsLayout({ children }: { children: ReactNode }) {
  if (!isRevopsShellEnabled()) redirect('/crm');
  return <RevOpsShell>{children}</RevOpsShell>;
}

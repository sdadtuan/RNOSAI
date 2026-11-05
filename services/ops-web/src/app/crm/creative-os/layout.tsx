import type { ReactNode } from 'react';
import { CpShell } from '@/components/crm/cp/CpShell';
import './cp.css';

export default function CreativeOsLayout({ children }: { children: ReactNode }) {
  return <CpShell>{children}</CpShell>;
}

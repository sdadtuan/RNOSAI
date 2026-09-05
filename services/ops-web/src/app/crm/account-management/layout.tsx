import type { ReactNode } from 'react';
import { AmShell } from '@/components/crm/am/AmShell';
import './am.css';

export default function AmLayout({ children }: { children: ReactNode }) {
  return <AmShell>{children}</AmShell>;
}

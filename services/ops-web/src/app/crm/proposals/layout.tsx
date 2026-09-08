import type { ReactNode } from 'react';
import { QtShell } from '@/components/crm/qt/QtShell';
import './qt.css';

export default function ProposalsLayout({ children }: { children: ReactNode }) {
  return <QtShell>{children}</QtShell>;
}

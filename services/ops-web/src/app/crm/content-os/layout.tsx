import type { ReactNode } from 'react';
import { CmktEShell } from '@/components/content-os/cmkte/CmktEShell';
import '@/styles/cmkte.css';

export default function ContentOsLayout({ children }: { children: ReactNode }) {
  return <CmktEShell>{children}</CmktEShell>;
}

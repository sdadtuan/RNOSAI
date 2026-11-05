import type { ReactNode } from 'react';
import { MsosShell } from '@/components/media-os/MsosShell';
import '@/styles/msos.css';

export default function MediaOsLayout({ children }: { children: ReactNode }) {
  return <MsosShell>{children}</MsosShell>;
}

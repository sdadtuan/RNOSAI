'use client';

import { ToastProvider } from '@/lib/toast';
import { PwaShell } from '@/components/pwa/PwaShell';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <PwaShell />
      {children}
    </ToastProvider>
  );
}

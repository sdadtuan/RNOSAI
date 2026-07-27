'use client';

import { ToastProvider } from '@/lib/toast';
import { PwaShell } from '@/components/pwa/PwaShell';
import { GlobalNlQueryPalette } from '@/components/ai/GlobalNlQueryPalette';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <PwaShell />
      <GlobalNlQueryPalette />
      {children}
    </ToastProvider>
  );
}

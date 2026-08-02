'use client';

import { ToastProvider } from '@/lib/toast';
import { DeployChunkRecovery } from '@/components/pwa/DeployChunkRecovery';
import { PwaShell } from '@/components/pwa/PwaShell';
import { GlobalNlQueryPalette } from '@/components/ai/GlobalNlQueryPalette';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <DeployChunkRecovery />
      <PwaShell />
      <GlobalNlQueryPalette />
      {children}
    </ToastProvider>
  );
}

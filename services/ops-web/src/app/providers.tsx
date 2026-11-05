'use client';

import { ToastProvider } from '@/lib/toast';
import { DeployChunkRecovery } from '@/components/pwa/DeployChunkRecovery';
import { PwaShell } from '@/components/pwa/PwaShell';
import { GlobalNlQueryPalette } from '@/components/ai/GlobalNlQueryPalette';
import { AuthCookieSync } from '@/components/auth/AuthCookieSync';
import { BrandProvider } from '@/components/brand/BrandProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <BrandProvider>
        <AuthCookieSync />
        <DeployChunkRecovery />
        <PwaShell />
        <GlobalNlQueryPalette />
        {children}
      </BrandProvider>
    </ToastProvider>
  );
}

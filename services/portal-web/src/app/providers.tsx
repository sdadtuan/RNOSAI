'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { ToastProvider } from '@/lib/toast';
import { initPortalSentry } from '@/lib/sentry.client';
import { PortalPwaShell } from '@/components/pwa/PortalPwaShell';
import { CapacitorShellInit } from '@/components/capacitor/CapacitorShellInit';
import { PersistentPortalChrome } from '@/components/PersistentPortalChrome';
import { NavTransitionProvider } from '@/lib/portal/nav-transition';

function isCapacitorNative(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [native, setNative] = useState(false);

  useEffect(() => {
    initPortalSentry();
    if (isCapacitorNative()) setNative(true);
  }, []);

  return (
    <ToastProvider>
      {native ? <Script src="/capacitor-native-bridge.js" strategy="afterInteractive" /> : null}
      <CapacitorShellInit />
      <PortalPwaShell />
      <NavTransitionProvider>
        <PersistentPortalChrome>{children}</PersistentPortalChrome>
      </NavTransitionProvider>
    </ToastProvider>
  );
}

'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function pwaEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_PWA_ENABLED === '0') return false;
  if (typeof window === 'undefined') return false;
  return true;
}

export function PwaShell() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!pwaEnabled()) return;

    const dismissedKey = 'ptt-pwa-install-dismissed';
    if (sessionStorage.getItem(dismissedKey) === '1') {
      setDismissed(true);
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        /* dev or unsupported — non-fatal */
      });
    }

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  async function onInstallClick() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);
    if (choice.outcome === 'dismissed') {
      sessionStorage.setItem('ptt-pwa-install-dismissed', '1');
      setDismissed(true);
    }
  }

  function onDismissBanner() {
    sessionStorage.setItem('ptt-pwa-install-dismissed', '1');
    setDismissed(true);
    setInstallEvent(null);
  }

  if (!pwaEnabled() || dismissed || !installEvent) {
    return null;
  }

  return (
    <div className="pwa-install-banner" role="region" aria-label="Cài PWA">
      <p>
        <strong>Cài PTT CRM</strong> — mở lead nhanh trên điện thoại (RNOS-41).
      </p>
      <div className="pwa-install-banner__actions">
        <button type="button" className="btn btn-sm" onClick={() => void onInstallClick()}>
          Thêm vào màn hình chính
        </button>
        <button type="button" className="btn btn-sm btn-secondary" onClick={onDismissBanner}>
          Để sau
        </button>
      </div>
    </div>
  );
}

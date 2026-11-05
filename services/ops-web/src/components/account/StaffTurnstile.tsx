'use client';

import Script from 'next/script';
import { useCallback, useEffect, useRef, useState } from 'react';

export const TURNSTILE_SITE_KEY = (process.env.NEXT_PUBLIC_PTT_TURNSTILE_SITE_KEY ?? '').trim();

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      size?: 'invisible' | 'normal' | 'compact';
      callback?: (token: string) => void;
      'error-callback'?: () => void;
      'expired-callback'?: () => void;
    },
  ) => string;
  execute: (widgetId: string) => void;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type StaffTurnstileProps = {
  active: boolean;
  onToken: (token: string | null) => void;
};

export function StaffTurnstile({ active, onToken }: StaffTurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);

  const resetWidget = useCallback(() => {
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
    onToken(null);
  }, [onToken]);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !ready || !active || !containerRef.current || !window.turnstile) {
      return;
    }
    if (widgetIdRef.current) {
      resetWidget();
      window.turnstile.execute(widgetIdRef.current);
      return;
    }
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      size: 'invisible',
      callback: (token) => onToken(token),
      'error-callback': () => onToken(null),
      'expired-callback': () => onToken(null),
    });
    window.turnstile.execute(widgetIdRef.current);
  }, [active, ready, onToken, resetWidget]);

  useEffect(() => {
    if (!active) {
      onToken(null);
    }
  }, [active, onToken]);

  useEffect(() => {
    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, []);

  if (!TURNSTILE_SITE_KEY) {
    return null;
  }

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="lazyOnload"
        onLoad={() => setReady(true)}
      />
      <div ref={containerRef} className="account-turnstile" aria-hidden="true" />
    </>
  );
}

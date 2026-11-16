import { useEffect, useRef } from 'react';
import { PORTAL_ADS_POLL_MS } from '@/lib/portal/ads-live-refresh';

/**
 * Repeat `callback` every `intervalMs` while the browser tab is visible.
 * Stops when the document is hidden; fires once immediately when it becomes
 * visible again. Does not run on mount (the caller loads data itself).
 */
export function useVisiblePoll(
  callback: () => void,
  intervalMs: number = PORTAL_ADS_POLL_MS,
  enabled = true,
): void {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;

    let timer: ReturnType<typeof setInterval> | undefined;
    const run = () => {
      if (document.visibilityState === 'hidden') return;
      cbRef.current();
    };
    const start = () => {
      if (timer != null) return;
      timer = setInterval(run, intervalMs);
    };
    const stop = () => {
      if (timer == null) return;
      clearInterval(timer);
      timer = undefined;
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        run();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs, enabled]);
}

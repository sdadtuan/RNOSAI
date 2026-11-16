/** How often Ads pages re-read stored Portal data. Never triggers Meta/Zalo Graph sync. */
export const PORTAL_ADS_POLL_MS = 60_000;

/** HH:mm in Asia/Ho_Chi_Minh, stable across locales. */
export function saigonHm(at: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(at);
}

export function adsUpdatedLabel(at: Date | null): string {
  return at ? `Cập nhật lúc ${saigonHm(at)}` : '';
}

/**
 * 'quiet' keeps previously rendered data on screen (poll or date change).
 * 'full' is the first load, when there is nothing to show yet.
 */
export function adsLoadMode(hasData: boolean, reason: 'poll' | 'user'): 'full' | 'quiet' {
  if (reason === 'poll') return 'quiet';
  return hasData ? 'quiet' : 'full';
}

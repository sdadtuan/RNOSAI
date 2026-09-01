export function deviceLabelFromUa(ua: string): string {
  const raw = (ua ?? '').trim();
  if (!raw) return 'Không rõ';

  const browser = detectBrowser(raw);
  const os = detectOs(raw);
  if (browser && os) return `${browser} · ${os}`;
  if (browser) return browser;
  if (os) return os;
  return 'Không rõ';
}

function detectBrowser(ua: string): string | null {
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/OPR\//i.test(ua) || /Opera/i.test(ua)) return 'Opera';
  if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return 'Chrome';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return 'Safari';
  return null;
}

function detectOs(ua: string): string | null {
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return 'Android';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'macOS';
  if (/Windows NT/i.test(ua)) return 'Windows';
  if (/Linux/i.test(ua)) return 'Linux';
  return null;
}

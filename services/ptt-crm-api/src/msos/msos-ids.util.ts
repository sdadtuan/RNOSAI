import { randomBytes } from 'crypto';

export type MsosIdPrefix = 'PTN' | 'INV' | 'RC' | 'PKG' | 'IO' | 'ML' | 'TP' | 'EV' | 'EP' | 'DC' | 'MG';

export function msosDateStamp(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(now)
    .replace(/-/g, '');
}

export function msosDisplayCode(prefix: MsosIdPrefix, now = new Date()): string {
  const hex = randomBytes(2).toString('hex').toUpperCase();
  return `${prefix}-${msosDateStamp(now)}-${hex}`;
}

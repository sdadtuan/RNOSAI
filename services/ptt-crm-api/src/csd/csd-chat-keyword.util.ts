import type { CsdPriority } from './csd.types';

const P1_RE = /(?:gấp|sự cố|ngưng chạy|sập|mất lead)/i;
const P2_RE = /(?:lỗi|không chạy|spend)/i;

export function suggestPriorityFromText(text: string): Extract<CsdPriority, 'P1' | 'P2'> | null {
  const body = String(text ?? '').trim();
  if (!body) return null;
  if (P1_RE.test(body)) return 'P1';
  if (P2_RE.test(body)) return 'P2';
  return null;
}

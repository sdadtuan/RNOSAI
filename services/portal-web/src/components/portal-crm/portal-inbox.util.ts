/** Client-side helpers for the Pancake-style portal inbox. */

const PHONE_RE = /(?:\+?84|0)[\s.-]*[1-9](?:[\s.-]*\d){8,9}/g;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const IMAGE_RE = /https?:\/\/[^\s]+/g;
const ADDRESS = /địa chỉ|dia chi|phường|quận|huyện|thành phố|tp\.|tỉnh/i;

export function displayVnPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return raw.trim();
  let n = digits;
  if (n.startsWith('84') && n.length >= 11) n = `0${n.slice(2)}`;
  else if (!n.startsWith('0') && n.length >= 9) n = `0${n}`;
  return n;
}

export function extractContacts(text: string): { phones: string[]; emails: string[] } {
  const phones: string[] = [];
  const emails: string[] = [];
  const seenPhone = new Set<string>();
  const seenEmail = new Set<string>();
  const src = String(text ?? '');
  for (const match of src.match(PHONE_RE) ?? []) {
    const shown = displayVnPhone(match);
    if (shown.length >= 9 && !seenPhone.has(shown)) {
      seenPhone.add(shown);
      phones.push(shown);
    }
  }
  for (const match of src.match(EMAIL_RE) ?? []) {
    const email = match.toLowerCase();
    if (!seenEmail.has(email)) {
      seenEmail.add(email);
      emails.push(email);
    }
  }
  return { phones, emails };
}

export function scanContact(text: string): { phone: string | null; address: string | null } {
  const { phones } = extractContacts(text);
  const line = text
    .split(/\n/)
    .map((part) => part.trim())
    .reverse()
    .find((part) => ADDRESS.test(part));
  return { phone: phones[0] ?? null, address: line ? line.replace(/\s+/g, ' ').slice(0, 90) : null };
}

export function splitMedia(body: string): { text: string; images: string[] } {
  const images: string[] = [];
  const seen = new Set<string>();
  const src = String(body ?? '');
  for (const url of src.match(IMAGE_RE) ?? []) {
    const clean = url.replace(/[),.;]+$/, '');
    if (
      /\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i.test(clean) ||
      /fbcdn\.net|scontent|cdninstagram/i.test(clean)
    ) {
      if (!seen.has(clean)) {
        seen.add(clean);
        images.push(clean);
      }
    }
  }
  let text = src;
  for (const image of images) text = text.replace(image, '').trim();
  return { text: text.replace(/\n{3,}/g, '\n\n').trim(), images };
}

export function initials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function avatarTone(name: string): string {
  const palette = ['#0f766e', '#1d4ed8', '#7c3aed', '#b45309', '#be123c', '#0369a1', '#365314'];
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}

export function relativeTime(value: string, now = new Date()): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diff = now.getTime() - date.getTime();
  if (diff < 45_000) return 'vừa xong';
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))} phút`;
  const dayFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const today = dayFmt.format(now);
  const that = dayFmt.format(date);
  const time = date.toLocaleTimeString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  if (that === today) return time;
  const yesterday = dayFmt.format(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  if (that === yesterday) return `Hôm qua ${time}`;
  return date.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function absoluteTime(value: string): string {
  if (!value) return 'Không có mốc thời gian';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Không có mốc thời gian';
  return date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

export function slashQuery(text: string, cursor?: number): { start: number; query: string } | null {
  const upto = cursor == null ? text.length : cursor;
  const left = text.slice(0, upto);
  const at = left.lastIndexOf('/');
  if (at < 0) return null;
  if (at > 0 && !/\s/.test(left[at - 1] ?? '')) return null;
  const query = left.slice(at + 1);
  if (/\s/.test(query)) return null;
  return { start: at, query };
}

/** Show a Page's human name, or a short fallback — never a raw 15-digit id. */
export function displayPageName(pageId: string, pageName?: string | null): string {
  const id = String(pageId ?? '').trim();
  const name = String(pageName ?? '').trim();
  if (name && name !== id && !/^\d{8,}$/.test(name)) return name;
  const tail = id.slice(-4);
  return tail ? `Page …${tail}` : 'Page';
}

export type CsdChatMessageSegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; value: string }
  | { type: 'ticket'; value: string }
  | { type: 'url'; value: string; href: string };

const MENTION_RE = /^@\d+$/;
const TICKET_RE = /^#PTT-\d{4}-\d{6}$/i;
const URL_PREFIX_RE = /^(https?:\/\/|www\.)/i;

/** Split on @mentions, ticket refs, and http(s)/www URLs (Zalo-style autolink). */
const SEGMENT_SPLIT_RE = /(@\d+|#PTT-\d{4}-\d{6}|https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;

function trimTrailingUrlPunctuation(url: string): string {
  return url.replace(/[.,;:!?\)\]\}>]+$/, '');
}

export function normalizeCsdChatUrl(raw: string): string | null {
  const trimmed = trimTrailingUrlPunctuation(raw.trim());
  const withScheme = /^www\./i.test(trimmed) ? `https://${trimmed}` : trimmed;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.href;
  } catch {
    return null;
  }
}

export function splitCsdChatMessageText(text: string): CsdChatMessageSegment[] {
  const parts = String(text).split(SEGMENT_SPLIT_RE);
  const segments: CsdChatMessageSegment[] = [];

  for (const part of parts) {
    if (!part) continue;
    if (MENTION_RE.test(part)) {
      segments.push({ type: 'mention', value: part });
      continue;
    }
    if (TICKET_RE.test(part)) {
      segments.push({ type: 'ticket', value: part });
      continue;
    }
    if (URL_PREFIX_RE.test(part)) {
      const display = trimTrailingUrlPunctuation(part);
      const href = normalizeCsdChatUrl(display);
      if (href) {
        segments.push({ type: 'url', value: display, href });
        const trailing = part.slice(display.length);
        if (trailing) segments.push({ type: 'text', value: trailing });
        continue;
      }
    }
    segments.push({ type: 'text', value: part });
  }

  return segments;
}

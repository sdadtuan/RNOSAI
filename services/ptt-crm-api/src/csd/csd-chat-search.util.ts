const MENTION_RE = /(^|[^\w])@(\d+)\b/g;
const TICKET_CODE_RE = /#?(PTT-\d{4}-\d{6})\b/gi;

export function parseMentions(body: string): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  const text = String(body ?? '');
  for (const match of text.matchAll(MENTION_RE)) {
    const id = Number(match[2]);
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function parseTicketCodes(body: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const text = String(body ?? '');
  for (const match of text.matchAll(TICKET_CODE_RE)) {
    const code = String(match[1]).toUpperCase();
    if (seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

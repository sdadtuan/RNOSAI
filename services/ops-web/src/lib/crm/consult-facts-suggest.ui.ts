export const CONSULT_CHANNEL_OPTIONS = [
  'Facebook Ads',
  'Google Ads',
  'Zalo',
  'SEO',
  'TikTok',
  'Fanpage',
  'Website / landing',
] as const;

export function formatChannelsBrief(selected: readonly string[], close: string): string {
  const lines = selected.map((item) => item.trim()).filter(Boolean);
  const note = close.trim();
  if (note) lines.push(/^cách chốt\s*:/i.test(note) ? note : `Cách chốt: ${note}`);
  return lines.join('\n');
}

export function parseChannelsBrief(text: string): { selected: string[]; close: string } {
  const selected: string[] = [];
  const extras: string[] = [];
  let close = '';
  for (const raw of String(text ?? '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const closeMatch = line.match(/^cách chốt\s*:\s*(.*)$/i);
    if (closeMatch) {
      close = closeMatch[1].trim();
      continue;
    }
    const known = CONSULT_CHANNEL_OPTIONS.find((option) => option.toLowerCase() === line.toLowerCase());
    if (known && !selected.includes(known)) selected.push(known);
    else extras.push(line);
  }
  if (!close && extras.length) close = extras.join(' ');
  return { selected, close };
}

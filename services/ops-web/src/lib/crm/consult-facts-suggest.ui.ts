export const CONSULT_CHANNEL_OPTIONS = [
  'Facebook Ads',
  'Google Ads',
  'Zalo',
  'SEO',
  'TikTok',
  'Fanpage',
  'Website / landing',
] as const;

export const CONSULT_GOAL_STUBS = [
  'Tăng số lịch đặt đúng tệp khách — mốc số [cần chốt]',
  'Giảm chi phí mỗi lịch hẹn — mốc [cần chốt]',
  'Tăng tỷ lệ khách đến sau khi để lại số — mốc [cần chốt]',
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

/** Normalize AI goal suggestions and pad with measurable stubs so chips are never empty. */
export function normalizeConsultGoalPicks(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : String(raw ?? '').split('\n');
  const goals: string[] = [];
  for (const item of list) {
    const text = String(item ?? '').trim();
    if (text && !goals.includes(text)) goals.push(text);
    if (goals.length === 3) break;
  }
  for (const stub of CONSULT_GOAL_STUBS) {
    if (goals.length === 3) break;
    if (!goals.includes(stub)) goals.push(stub);
  }
  return goals;
}

export function applyConsultFactsSuggest(
  current: { usp: string; goal: string; selected: readonly string[]; close: string },
  suggestion: { usp?: string; goals?: unknown; channels?: readonly string[]; close?: string },
  mode: 'fill-empty' | 'replace',
): { usp: string; goal: string; goalPicks: string[]; selected: string[]; close: string } {
  const goalPicks = normalizeConsultGoalPicks(suggestion.goals);
  const replace = mode === 'replace';
  const usp = replace || !current.usp.trim() ? String(suggestion.usp ?? '').trim() || current.usp : current.usp;
  const goal = replace || !current.goal.trim() ? (goalPicks[0] ?? current.goal) : current.goal;
  const selected =
    replace || current.selected.length === 0
      ? (suggestion.channels ?? []).map((item) => String(item).trim()).filter(Boolean)
      : [...current.selected];
  const close =
    replace || !current.close.trim() ? String(suggestion.close ?? '').trim() || current.close : current.close;
  return { usp, goal, goalPicks, selected, close };
}

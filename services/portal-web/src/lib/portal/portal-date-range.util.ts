/** Saigon calendar helpers. Stored values are always YYYY-MM-DD. Display is dd/mm/yyyy. */

export function saigonYmd(date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

export function saigonAddDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const utc = Date.UTC(y, (m || 1) - 1, (d || 1) + days, 12);
  return saigonYmd(new Date(utc));
}

export function saigonMonthStart(ymd = saigonYmd()): string {
  return `${ymd.slice(0, 7)}-01`;
}

export function formatViDate(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '').trim());
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function parseViDate(raw: string): string | null {
  const s = String(raw || '').trim();
  if (!s) return '';
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) return validYmd(iso[1], iso[2], iso[3]);
  const vi = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/.exec(s);
  if (vi) return validYmd(vi[3], vi[2].padStart(2, '0'), vi[1].padStart(2, '0'));
  return null;
}

function validYmd(y: string, m: string, d: string): string | null {
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000 || year > 2100) return null;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) return null;
  return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

export type DatePresetId = 'today' | '7d' | '30d' | 'month' | '';

export const DATE_PRESETS: Array<{ id: Exclude<DatePresetId, ''>; label: string }> = [
  { id: 'today', label: 'Hôm nay' },
  { id: '7d', label: '7 ngày' },
  { id: '30d', label: '30 ngày' },
  { id: 'month', label: 'Tháng này' },
];

export function presetRange(id: Exclude<DatePresetId, ''>, today = saigonYmd()): { from: string; to: string } {
  if (id === 'today') return { from: today, to: today };
  if (id === '7d') return { from: saigonAddDays(today, -6), to: today };
  if (id === '30d') return { from: saigonAddDays(today, -29), to: today };
  return { from: saigonMonthStart(today), to: today };
}

export function matchPreset(from: string, to: string, today = saigonYmd()): DatePresetId {
  for (const { id } of DATE_PRESETS) {
    const r = presetRange(id, today);
    if (r.from === from && r.to === to) return id;
  }
  return '';
}

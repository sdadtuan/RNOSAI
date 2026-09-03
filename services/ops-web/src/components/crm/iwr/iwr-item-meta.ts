export type IwrItemPriority = 'high' | 'medium' | 'low';
export type IwrItemSeverity = 'critical' | 'high' | 'medium' | 'low';

export type IwrItemMeta = {
  b2b_project_id?: string;
  project?: string;
  progress?: number;
  eta?: string;
  priority?: IwrItemPriority;
  checked?: boolean;
  support?: string;
  severity?: IwrItemSeverity;
  due?: string;
  note?: string;
  evidence_name?: string;
  text?: string;
  target?: number;
  actual?: number;
  unit?: string;
  better?: 'higher' | 'lower';
  owner?: string;
  step?: number;
};

export function kpiDelta(target: number, actual: number, better: 'higher' | 'lower' = 'higher') {
  const diff = actual - target;
  const pct = target === 0 ? 0 : (diff / Math.abs(target)) * 100;
  const good = better === 'lower' ? actual <= target : actual >= target;
  return { diff, pct, good };
}

export function formatKpiNumber(value: number, unit?: string): string {
  const n = Number.isFinite(value) ? value : 0;
  const formatted = Math.abs(n) >= 1000 ? n.toLocaleString('vi-VN') : String(n);
  if (!unit || unit === '%') return unit === '%' ? `${formatted}%` : formatted;
  return `${formatted}${unit === 'đ' ? 'đ' : ` ${unit}`}`;
}

export function parseIwrItemMeta(body: string | null | undefined): IwrItemMeta {
  const raw = String(body ?? '').trim();
  if (!raw) return {};
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as IwrItemMeta;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      /* plain text from older drafts */
    }
  }
  return { text: raw, note: raw };
}

export function serializeIwrItemMeta(meta: IwrItemMeta): string {
  return JSON.stringify(meta);
}

export function iwrItemText(meta: IwrItemMeta): string {
  return String(meta.text ?? meta.note ?? '').trim();
}

export function clampProgress(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function formatViYmd(ymd: string | null | undefined): string {
  if (!ymd) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return ymd;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function formatViTime(iso: string | Date | null | undefined): string {
  if (!iso) return '';
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

export function isOverdueYmd(ymd: string | null | undefined, today = new Date()): boolean {
  if (!ymd) return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return false;
  const vn = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const cur = `${vn.getFullYear()}-${String(vn.getMonth() + 1).padStart(2, '0')}-${String(vn.getDate()).padStart(2, '0')}`;
  return ymd < cur;
}

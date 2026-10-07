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
  asset_type?: string;
  campaign?: string;
  ad_account?: string;
  customer_account?: string;
  kpi_waived?: boolean;
  kpi_waive_reason?: string;
  meeting?: boolean;
  calendar_url?: string;
  kpi_id?: number | null;
  kpi_label?: string;
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
  return String(meta.text ?? meta.note ?? '');
}

const NEW_TASK_TITLE = 'Công việc mới';

export function iwrTaskTitleInput(title: string | null | undefined): string {
  const value = String(title ?? '');
  return value.trim() === NEW_TASK_TITLE ? '' : value;
}

export function iwrNormalizeEvidenceUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[\w.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(value)) return `https://${value}`;
  return value;
}

export function iwrTitleForKpi(current: string | null | undefined, metricName: string): string {
  if (iwrTaskTitleInput(current).trim()) return String(current ?? '');
  return metricName.trim() || String(current ?? '');
}

export type IwrKpiSource = {
  id: number;
  metric_name: string;
  metric_unit?: string | null;
  metric_higher_is_better?: number | null;
  target_value: number | null;
  actual_value: number | null;
  status?: string | null;
};

export function iwrKpiProgress(row: IwrKpiSource): number {
  const status = String(row.status ?? '').toLowerCase();
  const target = Number(row.target_value);
  const actual = Number(row.actual_value);
  if (
    row.target_value == null ||
    row.actual_value == null ||
    !Number.isFinite(target) ||
    target === 0 ||
    !Number.isFinite(actual)
  ) {
    return status === 'achieved' || status === 'ok' ? 100 : 0;
  }
  const higher = Number(row.metric_higher_is_better ?? 1) === 1;
  const ratio = higher ? actual / target : target / Math.max(actual, 1e-9);
  return clampProgress(ratio * 100);
}

export function iwrKpiSection(row: IwrKpiSource): 'done' | 'wip' {
  const status = String(row.status ?? '').toLowerCase();
  if (status === 'achieved' || status === 'ok' || iwrKpiProgress(row) >= 100) return 'done';
  return 'wip';
}

export function iwrKpiItemSeed(row: IwrKpiSource): { section: 'done' | 'wip'; title: string; body: string } {
  const section = iwrKpiSection(row);
  return {
    section,
    title: row.metric_name.trim() || 'KPI',
    body: serializeIwrItemMeta({
      b2b_project_id: '',
      project: '',
      progress: iwrKpiProgress(row),
      kpi_id: row.id,
      kpi_label: row.metric_name,
      note: iwrKpiScore(row),
      eta: '',
    }),
  };
}

export function iwrKpiScore(row: {
  actual_value: number | null;
  target_value: number | null;
  metric_unit?: string | null;
}): string {
  const fmt = (n: number | null) => (n == null || !Number.isFinite(Number(n)) ? '—' : String(n));
  const unit = String(row.metric_unit ?? '').trim();
  return `${fmt(row.actual_value)}/${fmt(row.target_value)}${unit ? ` ${unit}` : ''}`;
}

export function iwrVisibleEvidenceUrl(url: string | null | undefined): string {
  const value = String(url ?? '').trim();
  return /^https?:\/\//i.test(value) ? value : '';
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

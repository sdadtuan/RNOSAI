import type { IwrRag, IwrReportRow } from '@/lib/crm/iwr-api';
import { clampProgress, isOverdueYmd, parseIwrItemMeta, type IwrItemMeta } from './iwr-item-meta';

export type IwrProjectProgressRow = {
  id: string;
  name: string;
  client: string;
  green: number;
  yellow: number;
  red: number;
};

export const IWR_PROJECT_PROGRESS_DEMO: IwrProjectProgressRow[] = [
  { id: 'acb', name: 'Website Redesign', client: 'ACB Bank', green: 14, yellow: 3, red: 1 },
  { id: 'vinfast', name: 'Campaign Q4', client: 'VinFast', green: 11, yellow: 4, red: 2 },
  { id: 'pnj', name: 'Social Always On', client: 'PNJ', green: 9, yellow: 5, red: 3 },
  { id: 'tcb', name: 'Brand Video Series', client: 'Techcombank', green: 12, yellow: 2, red: 1 },
  { id: 'tiki', name: 'SEO Growth', client: 'Tiki', green: 10, yellow: 3, red: 1 },
  { id: 'momo', name: 'Product Launch', client: 'Momo', green: 7, yellow: 2, red: 3 },
];

const TRACK_SECTIONS = ['done', 'wip', 'deliverables', 'blocked', 'next', 'next_week'] as const;

export function parseIwrProjectLabel(raw: string): { name: string; client: string } {
  const text = String(raw ?? '').trim();
  if (!text) return { name: '', client: '' };
  const paren = /^(.+?)\s*\(([^)]+)\)\s*$/.exec(text);
  if (paren) return { name: paren[1].trim(), client: paren[2].trim() };
  const dash = /^(.+?)\s*[—–-]\s*(.+)$/.exec(text);
  if (dash && dash[2].length <= 40) return { name: dash[1].trim(), client: dash[2].trim() };
  return { name: text, client: '' };
}

function slugId(name: string, client: string): string {
  return `${name}-${client}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project';
}

function classifyItem(
  meta: IwrItemMeta,
  sectionKey: string,
  reportRag: IwrRag,
): 'green' | 'yellow' | 'red' {
  if (sectionKey === 'blocked') return 'red';
  if (reportRag === 'red' || meta.severity === 'critical') return 'red';
  const progress = clampProgress(meta.progress ?? (sectionKey === 'done' ? 100 : sectionKey === 'wip' ? 40 : 0));
  if (progress >= 80 || sectionKey === 'done') return 'green';
  if (reportRag === 'yellow' || (meta.eta && isOverdueYmd(meta.eta) && progress < 100)) return 'yellow';
  if (progress >= 40) return 'yellow';
  return 'red';
}

function projectKeyFromItem(rec: { title?: string; body?: string; project?: string }, fallbackTitle: string): string {
  const meta = parseIwrItemMeta(rec.body);
  const raw = String(meta.project ?? rec.project ?? rec.title ?? fallbackTitle ?? '').trim();
  const { name, client } = parseIwrProjectLabel(raw);
  return name ? `${name}::${client}` : '';
}

export function buildIwrProjectProgress(reports: IwrReportRow[]): {
  rows: IwrProjectProgressRow[];
  updatedAt: string | null;
  fromDemo: boolean;
} {
  const buckets = new Map<string, IwrProjectProgressRow>();
  let updatedAt: string | null = null;

  for (const report of reports) {
    const stamp = report.submitted_at || report.acknowledged_at;
    if (stamp && (!updatedAt || stamp > updatedAt)) updatedAt = stamp;

    for (const sectionKey of TRACK_SECTIONS) {
      const section = report.sections_json?.[sectionKey];
      const items = Array.isArray(section?.items) ? section.items : [];
      for (const raw of items) {
        if (!raw || typeof raw !== 'object') continue;
        const rec = raw as { title?: string; body?: string; project?: string };
        const key = projectKeyFromItem(rec, rec.title ?? report.title);
        if (!key) continue;
        const { name, client } = parseIwrProjectLabel(
          String(parseIwrItemMeta(rec.body).project ?? rec.project ?? rec.title ?? '').trim(),
        );
        if (!name) continue;
        const id = slugId(name, client);
        const row = buckets.get(key) ?? { id, name, client, green: 0, yellow: 0, red: 0 };
        const tone = classifyItem(parseIwrItemMeta(rec.body), sectionKey, report.rag);
        row[tone] += 1;
        buckets.set(key, row);
      }
    }
  }

  const rows = Array.from(buckets.values())
    .filter((r) => r.green + r.yellow + r.red > 0)
    .sort((a, b) => b.green + b.yellow + b.red - (a.green + a.yellow + a.red))
    .slice(0, 8);

  if (rows.length === 0) {
    return { rows: IWR_PROJECT_PROGRESS_DEMO, updatedAt, fromDemo: true };
  }
  return { rows, updatedAt, fromDemo: false };
}

export function iwrProjectProgressMaxY(rows: IwrProjectProgressRow[]): number {
  const peak = rows.reduce((max, row) => Math.max(max, row.green + row.yellow + row.red), 0);
  if (peak <= 5) return 5;
  return Math.ceil(peak / 5) * 5;
}

export function iwrProjectProgressYTicks(maxY: number): number[] {
  const step = maxY <= 10 ? 5 : maxY <= 20 ? 5 : 10;
  const ticks: number[] = [];
  for (let v = maxY; v >= 0; v -= step) ticks.push(v);
  if (ticks[ticks.length - 1] !== 0) ticks.push(0);
  return ticks;
}

export function formatIwrProjectProgressUpdated(iso: string | null | undefined, now = new Date()): string {
  const d = iso ? new Date(iso) : now;
  if (Number.isNaN(d.getTime())) {
    const vn = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const dd = String(vn.getDate()).padStart(2, '0');
    const mm = String(vn.getMonth() + 1).padStart(2, '0');
    const yyyy = vn.getFullYear();
    const hh = String(vn.getHours()).padStart(2, '0');
    const mi = String(vn.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  }
  return d.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

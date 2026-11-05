import type { B2bProjectListItem } from '@/lib/b2b-projects-api';
import type { IwrRag, IwrReportRow } from '@/lib/crm/iwr-api';
import { iwrB2bProjectCatalog, iwrB2bProjectOptionLabel, resolveIwrB2bProjectId } from './iwr-b2b-project';
import { clampProgress, isOverdueYmd, parseIwrItemMeta, type IwrItemMeta } from './iwr-item-meta';

export type IwrProjectProgressRow = {
  id: string;
  name: string;
  code: string;
  green: number;
  yellow: number;
  red: number;
};

const TRACK_SECTIONS = ['done', 'wip', 'deliverables', 'blocked', 'next', 'next_week'] as const;

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

export function buildIwrProjectProgress(
  reports: IwrReportRow[],
  b2bProjects: B2bProjectListItem[],
): {
  rows: IwrProjectProgressRow[];
  updatedAt: string | null;
} {
  const catalog = iwrB2bProjectCatalog(b2bProjects);
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
        const meta = parseIwrItemMeta(rec.body);
        const projectId = resolveIwrB2bProjectId(meta, catalog);
        if (!projectId) continue;

        const project = catalog.get(projectId)!;
        const row = buckets.get(projectId) ?? {
          id: projectId,
          name: project.name,
          code: project.code,
          green: 0,
          yellow: 0,
          red: 0,
        };
        const tone = classifyItem(meta, sectionKey, report.rag);
        row[tone] += 1;
        buckets.set(projectId, row);
      }
    }
  }

  const rows = Array.from(buckets.values())
    .filter((r) => r.green + r.yellow + r.red > 0)
    .sort((a, b) => b.green + b.yellow + b.red - (a.green + a.yellow + a.red))
    .slice(0, 8);

  return { rows, updatedAt };
}

export function iwrProjectProgressFilterOptions(
  b2bProjects: B2bProjectListItem[],
): Array<{ id: string; label: string }> {
  return b2bProjects
    .slice()
    .sort((a, b) => a.code.localeCompare(b.code, 'vi'))
    .map((project) => ({ id: project.id, label: iwrB2bProjectOptionLabel(project) }));
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

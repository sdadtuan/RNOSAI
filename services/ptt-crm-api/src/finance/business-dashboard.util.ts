import { parseYmd, todayYmd } from './finance-metrics.util';

export const EXECUTIVE_WEEKLY_DEFAULT = 12;
export const ATTRIBUTION_DRILL_DEFAULT = 5;

export interface ExecutiveWeekBucket {
  start: string;
  end: string;
  label: string;
  revenue_vnd: number;
  leads: number;
}

export interface AttributionDrillRow {
  campaign_key: string;
  campaign_label: string;
  lead_count: number;
  sample_lead_id: number | null;
  sample_lead_name: string | null;
  hub_href: string;
  lead_href: string | null;
}

function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function lastDayOfMonth(year: number, month: number): string {
  return formatYmd(new Date(year, month, 0));
}

export function resolveExecutiveAnchorYmd(year: number, month: number, asOf = todayYmd()): string {
  const monthEnd = lastDayOfMonth(year, month);
  return monthEnd < asOf ? monthEnd : asOf;
}

export function buildExecutiveWeekBuckets(anchorYmd: string, weeks = EXECUTIVE_WEEKLY_DEFAULT): ExecutiveWeekBucket[] {
  const anchor = parseYmd(anchorYmd);
  if (!anchor) return [];

  const anchorDate = new Date(`${anchor}T12:00:00`);
  const count = Math.max(2, Math.min(Math.trunc(weeks), 12));
  const buckets: ExecutiveWeekBucket[] = [];

  for (let i = count - 1; i >= 0; i--) {
    const endDate = new Date(anchorDate);
    endDate.setDate(endDate.getDate() - i * 7);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6);
    const end = formatYmd(endDate);
    const start = formatYmd(startDate);
    buckets.push({
      start,
      end,
      label: `${end.slice(8, 10)}/${end.slice(5, 7)}`,
      revenue_vnd: 0,
      leads: 0,
    });
  }

  return buckets;
}

export {
  getAttributionDrillPaths,
  getBusinessDashboardExecutive,
  getExecutiveWeeklyTrends,
} from './finance-pg-metrics.util';

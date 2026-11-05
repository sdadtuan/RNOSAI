import { TOWER_DEPT_CATALOG } from './ceo-tower-org.util';
import type { TowerPayload } from './ceo-tower.types';

const DEPT_DONUT_COLORS = [
  '#dc2626',
  '#b45309',
  '#17692f',
  '#2563eb',
  '#7c3aed',
  '#0891b2',
] as const;

export type BoardPackDeptRedSegment = {
  code: string;
  label: string;
  value: number;
  pct: number;
  color: string;
};

export function buildBoardPackDeptRedDonut(
  departments: Array<{
    code: string;
    label_vi: string;
    red_count: number;
    outside_cycle?: boolean;
  }>,
): BoardPackDeptRedSegment[] {
  const rows = departments.filter((row) => !row.outside_cycle && row.red_count > 0);
  const total = rows.reduce((sum, row) => sum + row.red_count, 0);
  if (total === 0) return [];

  let assigned = 0;
  return rows.map((row, index) => {
    const pct =
      index === rows.length - 1
        ? Math.max(0, 100 - assigned)
        : Math.round((row.red_count / total) * 100);
    assigned += pct;
    return {
      code: row.code,
      label: row.label_vi,
      value: row.red_count,
      pct,
      color: DEPT_DONUT_COLORS[index % DEPT_DONUT_COLORS.length],
    };
  });
}

const ICT_TZ = 'Asia/Ho_Chi_Minh';
const BOARD_PACK_WEEK_RE = /^(\d{4})-W(\d{2})$/;

export function ymdInIct(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ICT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${day}`;
}

export function isoWeekPartsFromYmd(ymd: string): { isoYear: number; isoWeek: number } {
  const utc = new Date(
    Date.UTC(
      Number(ymd.slice(0, 4)),
      Number(ymd.slice(5, 7)) - 1,
      Number(ymd.slice(8, 10)),
    ),
  );
  utc.setUTCDate(utc.getUTCDate() + 4 - (utc.getUTCDay() || 7));
  const isoYear = utc.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const isoWeek = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { isoYear, isoWeek };
}

export function formatBoardPackWeekLabel(isoYear: number, isoWeek: number): string {
  return `${isoYear}-W${String(isoWeek).padStart(2, '0')}`;
}

/** Default ISO week label for `now` in ICT — `YYYY-Www`. */
export function defaultBoardPackWeekLabel(now = new Date()): string {
  const { isoYear, isoWeek } = isoWeekPartsFromYmd(ymdInIct(now));
  return formatBoardPackWeekLabel(isoYear, isoWeek);
}

/** Parse `week=YYYY-Www` or default to current ISO week (ICT). */
export function resolveBoardPackWeek(week?: string, now = new Date()): string {
  const raw = String(week ?? '').trim();
  const match = BOARD_PACK_WEEK_RE.exec(raw);
  if (match) return raw;
  return defaultBoardPackWeekLabel(now);
}

export function isBoardPackNotifyEnabled(): boolean {
  return (process.env.PTT_CEO_BOARD_PACK_NOTIFY ?? '0').trim() === '1';
}

export function buildBoardPackFacts(
  payload: TowerPayload,
  weekLabel: string,
): Record<string, unknown> {
  const deptByCode = new Map(
    (payload.org_rollup ?? [])
      .filter((row) => row.level === 'department')
      .map((row) => [row.code, row]),
  );

  const departments = TOWER_DEPT_CATALOG.map((dept) => {
    const row = deptByCode.get(dept.code);
    return {
      code: dept.code,
      label_vi: dept.label_vi,
      red_count: row?.red_count ?? 0,
      amber_count: row?.amber_count ?? 0,
      outside_cycle: Boolean(row?.outside_cycle ?? dept.outside_cycle),
    };
  });

  const deptRedDonut = buildBoardPackDeptRedDonut(departments);

  const facts: Record<string, unknown> = {
    week: weekLabel,
    k_strip: payload.k_strip,
    columns: payload.columns.map((col) => ({
      column_id: col.column_id,
      red_count: col.red_count,
      amber_count: col.amber_count,
      header_severity: col.header_severity,
      ...(col.degraded ? { degraded: col.degraded } : {}),
    })),
    departments,
    ...(deptRedDonut.length ? { dept_red_donut: deptRedDonut } : {}),
    top_exceptions: payload.exceptions.slice(0, 10),
    capacity_top: payload.capacity_top ?? [],
    s11_fail: payload.sensors_ok.S11 === 'fail',
    s12_fail: payload.sensors_ok.S12 === 'fail',
    degraded: payload.degraded ?? [],
    decisions_blank: ['', '', ''],
  };

  if (payload.trends) {
    facts.trends = {
      labels: payload.trends.series.labels,
      total_issues: payload.trends.series.total_issues,
      red_issues: payload.trends.series.red_issues,
      wow: payload.trends.wow,
    };
  }

  if (payload.finance_strip?.length) {
    facts.finance = payload.finance_strip;
  }

  return facts;
}

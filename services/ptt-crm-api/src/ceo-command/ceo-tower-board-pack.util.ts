import { TOWER_DEPT_CATALOG } from './ceo-tower-org.util';
import type { TowerPayload } from './ceo-tower.types';

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
    top_exceptions: payload.exceptions.slice(0, 10),
    capacity_top: payload.capacity_top ?? [],
    s11_fail: payload.sensors_ok.S11 === 'fail',
    s12_fail: payload.sensors_ok.S12 === 'fail',
    degraded: payload.degraded ?? [],
    decisions_blank: ['', '', ''],
  };

  if (payload.finance_strip?.length) {
    facts.finance = payload.finance_strip;
  }

  return facts;
}

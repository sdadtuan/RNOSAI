import { saigonDateKey } from '@/lib/portal/portal-leads-table.util';

export const DASHBOARD_RANGE_PRESETS = [
  { id: 'today', pickerLabel: 'Hôm nay' },
  { id: '7', pickerLabel: '7 ngày' },
  { id: '30', pickerLabel: '30 ngày' },
  { id: 'month', pickerLabel: 'Tháng này' },
] as const;

export type DashboardRangePreset = (typeof DASHBOARD_RANGE_PRESETS)[number]['id'];

export type DashboardRange = {
  preset: DashboardRangePreset;
  from: string;
  to: string;
  label: string;
};

/** Calendar YYYY-MM-DD in Asia/Ho_Chi_Minh. */
export function saigonTodayYmd(now = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

/** Shift a calendar date (YYYY-MM-DD) by a whole number of days. */
export function shiftYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day + days));
  return dt.toISOString().slice(0, 10);
}

export function dashboardRange(preset: DashboardRangePreset, now = new Date()): DashboardRange {
  const today = saigonTodayYmd(now);
  if (preset === 'today') {
    return { preset, from: today, to: today, label: 'Hôm nay' };
  }
  if (preset === '7') {
    return { preset, from: shiftYmd(today, -6), to: today, label: '7 ngày qua' };
  }
  if (preset === '30') {
    return { preset, from: shiftYmd(today, -29), to: today, label: '30 ngày qua' };
  }
  const [year, month] = today.split('-');
  return { preset, from: `${year}-${month}-01`, to: today, label: 'Tháng này' };
}

/** Day a lead/message was received (created), Saigon calendar. */
export function receivedDay(row: { created_at?: string; last_interaction_at?: string }): string {
  return saigonDateKey(row.created_at || row.last_interaction_at || '');
}

export function countInRange<T>(
  rows: T[],
  from: string,
  to: string,
  dayOf: (row: T) => string,
): number {
  return rows.filter((row) => {
    const day = dayOf(row);
    return Boolean(day) && day >= from && day <= to;
  }).length;
}

export function groupCountByDay<T>(
  rows: T[],
  from: string,
  to: string,
  dayOf: (row: T) => string,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const day = dayOf(row);
    if (!day || day < from || day > to) continue;
    map.set(day, (map.get(day) ?? 0) + 1);
  }
  return map;
}

export function groupCountByCampaign<T extends { campaign_id?: string | null }>(
  rows: T[],
  from: string,
  to: string,
  dayOf: (row: T) => string,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const day = dayOf(row);
    if (!day || day < from || day > to) continue;
    const id = String(row.campaign_id ?? '').trim();
    if (!id) continue;
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

/** Format a YYYY-MM-DD (or ISO) value as dd/mm/yyyy. */
export function fmtDateDmy(value: string | null | undefined): string {
  if (!value) return '—';
  const match = value.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export const LEAD_MAPPED_LABEL = 'Lead gắn được chiến dịch';
export const LEAD_MAPPED_TIP =
  'Lead trong CRM đã gắn được với một chiến dịch quảng cáo trong khoảng đã chọn.';
export const LEAD_RECEIVED_LABEL = 'Lead nhận được';
export const LEAD_RECEIVED_TIP =
  'Tất cả lead ghi nhận trên portal trong khoảng đã chọn, kể cả chưa gắn chiến dịch.';
export const LEAD_PLATFORM_TIP =
  'Số lead do nền tảng quảng cáo (Meta) báo cáo trong khoảng đã chọn.';

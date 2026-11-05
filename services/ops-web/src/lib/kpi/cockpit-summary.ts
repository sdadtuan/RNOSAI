import type { StaffKpiGridEntry } from '@/lib/api';
import { deriveKpiRag, kpiIsOnTime, metricAchievementPct, type KpiRag } from '@/lib/kpi/rag';

export function deptLabel(raw: string | null | undefined): string {
  const v = String(raw ?? '').trim();
  return v || 'Chưa gắn phòng';
}

export function prevYearMonth(year: number, month: number): { year: number; month: number } {
  if (month <= 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

export function filterRowsByDepartment(
  rows: StaffKpiGridEntry[],
  department: string,
): StaffKpiGridEntry[] {
  if (!department || department === 'all') return rows;
  if (department === 'Chưa gắn phòng') {
    return rows.filter((r) => !String(r.staff_department ?? '').trim());
  }
  return rows.filter((r) => String(r.staff_department ?? '').trim() === department);
}

export function departmentOptions(rows: StaffKpiGridEntry[]): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    const label = deptLabel(row.staff_department);
    if (label !== 'Chưa gắn phòng') set.add(label);
  }
  if (rows.some((r) => !String(r.staff_department ?? '').trim())) set.add('Chưa gắn phòng');
  return [...set].sort((a, b) => a.localeCompare(b, 'vi'));
}

export type DeptProgress = {
  name: string;
  green: number;
  yellow: number;
  red: number;
  no_data: number;
  progress_pct: number | null;
};

export type AttentionRow = {
  id: number;
  metric_name: string;
  staff_name: string;
  department: string;
  actual_value: number | null;
  target_value: number | null;
  unit: string;
  achievement_pct: number | null;
  rag: KpiRag;
};

export type CockpitInsight = { headline: string; actions: string[] };

export type CockpitDelta = {
  green: number | null;
  yellow: number | null;
  red: number | null;
  completion_pct: number | null;
  ontime_pct: number | null;
};

export type CockpitSummary = {
  total: number;
  green: number;
  yellow: number;
  red: number;
  no_data: number;
  scored: number;
  completion_pct: number | null;
  ontime_count: number;
  ontime_pct: number | null;
  delta: CockpitDelta;
  by_department: DeptProgress[];
  attention: AttentionRow[];
  insight: CockpitInsight;
};

function countsOf(rows: StaffKpiGridEntry[], now: Date) {
  let green = 0;
  let yellow = 0;
  let red = 0;
  let no_data = 0;
  let scoredSum = 0;
  let scored = 0;
  let ontime = 0;
  for (const row of rows) {
    const year = Number(row.year);
    const month = Number(row.month);
    const rag = deriveKpiRag(row.metric_higher_is_better, row.target_value, row.actual_value);
    if (rag === 'green') green += 1;
    else if (rag === 'yellow') yellow += 1;
    else if (rag === 'red') red += 1;
    else no_data += 1;
    const pct = metricAchievementPct(row.metric_higher_is_better, row.target_value, row.actual_value);
    if (pct != null) {
      scored += 1;
      scoredSum += pct;
    }
    if (kpiIsOnTime(row.actual_value, row.updated_at, year, month, now)) ontime += 1;
  }
  const completion_pct = scored ? scoredSum / scored : null;
  const ontime_pct = rows.length ? Math.round((100 * ontime) / rows.length) : null;
  return { green, yellow, red, no_data, scored, completion_pct, ontime_count: ontime, ontime_pct };
}

function insightOf(red: number, yellow: number, ontime_pct: number | null, total: number): CockpitInsight {
  const actions: string[] = [];
  let headline = 'Không có KPI vàng/đỏ trong bộ lọc hiện tại.';
  if (red > 0) {
    headline = `Có ${red} KPI không đạt trong kỳ. Ưu tiên các hàng Đỏ.`;
    actions.push('Xử lý các KPI Đỏ trong danh sách cần chú ý.');
  } else if (yellow > 0) {
    headline = `Có ${yellow} KPI cần theo dõi.`;
    actions.push('Theo dõi các KPI Vàng trong danh sách cần chú ý.');
  }
  if (total > 0 && ontime_pct != null && ontime_pct < 80) {
    actions.push('Nhắc owner cập nhật actual trước hạn ngày 5.');
  }
  return { headline, actions: actions.slice(0, 2) };
}

const RAG_RANK: Record<KpiRag, number> = { red: 0, yellow: 1, no_data: 2, green: 3 };

export function buildCockpitSummary(
  rows: StaffKpiGridEntry[],
  prevRows: StaffKpiGridEntry[],
  now: Date,
): CockpitSummary {
  const cur = countsOf(rows, now);
  const prev = countsOf(prevRows, now);
  const byMap = new Map<string, StaffKpiGridEntry[]>();
  for (const row of rows) {
    const name = deptLabel(row.staff_department);
    const list = byMap.get(name) ?? [];
    list.push(row);
    byMap.set(name, list);
  }
  const by_department: DeptProgress[] = [...byMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'vi'))
    .map(([name, list]) => {
      const c = countsOf(list, now);
      return {
        name,
        green: c.green,
        yellow: c.yellow,
        red: c.red,
        no_data: c.no_data,
        progress_pct: c.completion_pct,
      };
    });

  const attention: AttentionRow[] = rows
    .map((row) => {
      const rag = deriveKpiRag(row.metric_higher_is_better, row.target_value, row.actual_value);
      return {
        id: row.id,
        metric_name: row.metric_name,
        staff_name: row.staff_name,
        department: deptLabel(row.staff_department),
        actual_value: row.actual_value,
        target_value: row.target_value,
        unit: row.metric_unit,
        achievement_pct: metricAchievementPct(row.metric_higher_is_better, row.target_value, row.actual_value),
        rag,
      };
    })
    .filter((row) => row.rag === 'red' || row.rag === 'yellow' || (row.rag === 'no_data' && row.target_value != null))
    .sort((a, b) => RAG_RANK[a.rag] - RAG_RANK[b.rag])
    .slice(0, 8);

  return {
    total: rows.length,
    green: cur.green,
    yellow: cur.yellow,
    red: cur.red,
    no_data: cur.no_data,
    scored: cur.scored,
    completion_pct: cur.completion_pct,
    ontime_count: cur.ontime_count,
    ontime_pct: cur.ontime_pct,
    delta: {
      green: prevRows.length === 0 ? null : cur.green - prev.green,
      yellow: prevRows.length === 0 ? null : cur.yellow - prev.yellow,
      red: prevRows.length === 0 ? null : cur.red - prev.red,
      completion_pct:
        cur.completion_pct == null || prev.completion_pct == null
          ? null
          : cur.completion_pct - prev.completion_pct,
      ontime_pct:
        cur.ontime_pct == null || prev.ontime_pct == null ? null : cur.ontime_pct - prev.ontime_pct,
    },
    by_department,
    attention,
    insight: insightOf(cur.red, cur.yellow, cur.ontime_pct, rows.length),
  };
}

export function rowTrend(
  row: StaffKpiGridEntry,
  prevRows: StaffKpiGridEntry[],
): 'up' | 'down' | 'flat' | null {
  const cur = metricAchievementPct(row.metric_higher_is_better, row.target_value, row.actual_value);
  const prev = prevRows.find((p) => p.staff_id === row.staff_id && p.metric_id === row.metric_id);
  const prevPct = prev
    ? metricAchievementPct(prev.metric_higher_is_better, prev.target_value, prev.actual_value)
    : null;
  if (cur == null || prevPct == null) return null;
  if (cur > prevPct) return 'up';
  if (cur < prevPct) return 'down';
  return 'flat';
}

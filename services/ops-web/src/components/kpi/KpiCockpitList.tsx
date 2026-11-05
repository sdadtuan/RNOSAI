'use client';

import { useMemo, useState } from 'react';
import type { StaffKpiGridEntry } from '@/lib/api';
import { deptLabel, rowTrend } from '@/lib/kpi/cockpit-summary';
import { formatNumber, formatPct } from '@/lib/kpi/format';
import { deriveKpiRag, metricAchievementPct, type KpiRag } from '@/lib/kpi/rag';

type Tab = 'all' | 'mine' | 'dept';

const PAGE_SIZE = 20;

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'all', label: 'Tất cả' },
  { id: 'mine', label: 'Cá nhân' },
  { id: 'dept', label: 'Phòng ban' },
];

const RAG_PILL: Record<KpiRag, string> = {
  green: 'Xanh',
  yellow: 'Vàng',
  red: 'Đỏ',
  no_data: 'Chưa có số',
};

const RAG_BG: Record<KpiRag, string> = {
  green: 'var(--success, #2e7d4f)',
  yellow: '#c58a00',
  red: 'var(--danger, #b42318)',
  no_data: 'var(--border)',
};

function ragClass(rag: KpiRag): string {
  return rag === 'no_data' ? 'kpi-rag' : `kpi-rag is-${rag}`;
}

function trendMark(trend: ReturnType<typeof rowTrend>) {
  if (trend === 'up') return <span className="kpi-rag is-green">↑</span>;
  if (trend === 'down') return <span className="kpi-rag is-red">↓</span>;
  return '—';
}

export function KpiCockpitList({
  rows,
  prevRows,
  userStaffId,
}: {
  rows: StaffKpiGridEntry[];
  prevRows: StaffKpiGridEntry[];
  userStaffId: number | null;
}) {
  const [tab, setTab] = useState<Tab>('all');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (tab === 'mine') return rows.filter((row) => row.staff_id === userStaffId);
    return rows;
  }, [rows, tab, userStaffId]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const sliced = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const deptGroups = useMemo(() => {
    const map = new Map<string, StaffKpiGridEntry[]>();
    for (const row of sliced) {
      const name = deptLabel(row.staff_department);
      const list = map.get(name) ?? [];
      list.push(row);
      map.set(name, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'vi'));
  }, [sliced]);

  function switchTab(next: Tab) {
    setTab(next);
    setPage(0);
  }

  function renderRow(row: StaffKpiGridEntry) {
    const rag = deriveKpiRag(row.metric_higher_is_better, row.target_value, row.actual_value);
    const pct = metricAchievementPct(row.metric_higher_is_better, row.target_value, row.actual_value);
    return (
      <tr key={row.id}>
        <td>{row.metric_name}</td>
        <td>{row.staff_name}</td>
        <td>{deptLabel(row.staff_department)}</td>
        <td>Tháng</td>
        <td>{row.target_value == null ? '—' : formatNumber(row.target_value)}</td>
        <td>{row.actual_value == null ? '—' : formatNumber(row.actual_value)}</td>
        <td>
          <div className="kpi-progress-mini">
            <span
              style={{
                width: pct == null ? '0%' : `${Math.min(100, Math.max(0, pct))}%`,
                background: RAG_BG[rag],
              }}
            />
          </div>
          {pct == null ? '—' : formatPct(pct)}
        </td>
        <td>{trendMark(rowTrend(row, prevRows))}</td>
        <td>
          <span className={ragClass(rag)}>{RAG_PILL[rag]}</span>
        </td>
      </tr>
    );
  }

  return (
    <section>
      <div className="kpi-cockpit-tabs" role="tablist" aria-label="Danh sách KPI">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`btn btn-sm${tab === item.id ? '' : ' btn-secondary'}`}
            onClick={() => switchTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="muted">Chưa có bản ghi KPI trong kỳ này.</p>
      ) : (
        <>
          <table className="kpi-cockpit-table">
            <thead>
              <tr>
                <th>Tên KPI</th>
                <th>Owner</th>
                <th>Phạm vi</th>
                <th>Chu kỳ</th>
                <th>Mục tiêu</th>
                <th>Thực tế</th>
                <th>Tiến độ</th>
                <th>Xu hướng</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            {tab === 'dept'
              ? deptGroups.map(([name, group]) => (
                  <tbody key={name}>
                    <tr>
                      <th colSpan={9}>{name}</th>
                    </tr>
                    {group.map(renderRow)}
                  </tbody>
                ))
              : (
                  <tbody>{sliced.map(renderRow)}</tbody>
                )}
          </table>
          <div className="kpi-cockpit-pager">
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={safePage <= 0}
              onClick={() => setPage(safePage - 1)}
            >
              Trước
            </button>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage(safePage + 1)}
            >
              Sau
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export default KpiCockpitList;

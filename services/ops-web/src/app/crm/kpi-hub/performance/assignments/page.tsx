'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { PmAmberNotice } from '@/components/kpi-hub/performance/PmMoatNotice';
import { PmPage, pmBadge } from '@/components/kpi-hub/performance/PmPage';
import { PmPageState } from '@/components/kpi-hub/performance/PmPageState';
import { PmQualityChip } from '@/components/kpi-hub/performance/PmQualityChip';
import { getAccessToken } from '@/lib/auth';
import { fetchPmAssignments } from '@/lib/performance-api';
import type { PmAssignment } from '@/lib/performance-types';

const TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'individual', label: 'Cá nhân' },
  { id: 'team', label: 'Team' },
  { id: 'department', label: 'Phòng ban' },
  { id: 'project', label: 'Dự án' },
  { id: 'client', label: 'Khách hàng' },
  { id: 'campaign', label: 'Campaign' },
];

function dirLabel(direction: string) {
  if (direction === 'lower') return '↓ lower';
  if (direction === 'higher') return '↑ higher';
  return direction;
}

function statusLabel(status: string) {
  if (status === 'green') return 'On track';
  if (status === 'yellow') return 'Watch';
  if (status === 'red') return 'Critical';
  return status;
}

function progressLabel(row: PmAssignment) {
  if (row.status === 'red' && row.direction === 'lower' && row.progress != null && row.progress > 100) {
    return `Overrun ${Math.round(row.progress - 100)}%`;
  }
  if (row.progress != null) {
    const tone = row.status === 'red' ? 'Red' : row.status === 'green' ? 'Green' : 'Yellow';
    return `${row.progress}% · ${tone}`;
  }
  return '—';
}

export default function PerformanceAssignmentsPage() {
  const token = getAccessToken() ?? '';
  const [tab, setTab] = useState('all');
  const [items, setItems] = useState<PmAssignment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [qualityFilter, setQualityFilter] = useState('all');
  const [directionFilter, setDirectionFilter] = useState('all');

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    void fetchPmAssignments(token)
      .then((res) => setItems(res.items))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không tải KPI'))
      .finally(() => setLoading(false));
  }, [token]);

  const rows = useMemo(() => {
    let list = tab === 'all' ? items : items.filter((i) => i.scope_type === tab);
    if (qualityFilter !== 'all') {
      list = list.filter((i) => i.quality.toLowerCase() === qualityFilter);
    }
    if (directionFilter !== 'all') {
      list = list.filter((i) => i.direction === directionFilter);
    }
    return list;
  }, [items, tab, qualityFilter, directionFilter]);

  return (
    <PmPage
      title="Assignment Registry"
      subtitle="PM-02 · Direction-aware · quality chip · Quoted Δ. Không average raw đơn vị."
      crumb="Assignment Registry"
      actions={
        <>
          <Link href="/crm/kpi-hub/performance/reports" className="kpi-hub-btn kpi-hub-btn--ghost">
            Export (audit)
          </Link>
          <Link href="/crm/kpi-hub/performance/assignments/new" className="kpi-hub-btn kpi-hub-btn--primary">
            ＋ Assignment
          </Link>
        </>
      }
    >
      <PmAmberNotice>
        <b>AC-PM-02:</b> CPA Meta 149K / target ≤160K là <b>Green</b> (lower-is-better). Tool OKR generic sẽ hiện 93%
        “thiếu” — đó là chỗ RNOSAI thắng.
      </PmAmberNotice>
      <PmPageState loading={loading} error={error} empty={!loading && !error && !rows.length} />
      {!loading && !error ? (
        <>
          <div className="kpi-hub-pm-tabs" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 7 }}>
            <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost" style={{ fontSize: '0.75rem' }}>
              Tháng 09/2026
            </button>
            <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost" style={{ fontSize: '0.75rem' }}>
              Toàn công ty
            </button>
            <button
              type="button"
              className={`kpi-hub-btn kpi-hub-btn--ghost${qualityFilter !== 'all' ? ' is-active' : ''}`}
              style={{ fontSize: '0.75rem' }}
              onClick={() =>
                setQualityFilter((q) => (q === 'all' ? 'verified' : q === 'verified' ? 'stale' : 'all'))
              }
            >
              Quality: {qualityFilter === 'all' ? 'All' : qualityFilter}
            </button>
            <button
              type="button"
              className={`kpi-hub-btn kpi-hub-btn--ghost${directionFilter !== 'all' ? ' is-active' : ''}`}
              style={{ fontSize: '0.75rem' }}
              onClick={() =>
                setDirectionFilter((d) => (d === 'all' ? 'lower' : d === 'lower' ? 'higher' : 'all'))
              }
            >
              Direction: {directionFilter === 'all' ? 'All' : directionFilter}
            </button>
          </div>
          <article className="kpi-hub-card">
            <div className="kpi-hub-pm-tabs">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={tab === t.id ? 'is-active' : ''}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="kpi-hub-card__body" style={{ overflowX: 'auto' }}>
              <table className="kpi-hub-table">
                <thead>
                  <tr>
                    <th>KPI</th>
                    <th>Owner</th>
                    <th>Scope</th>
                    <th>Dir</th>
                    <th>Target</th>
                    <th>Actual</th>
                    <th>Quoted Δ</th>
                    <th>Progress</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <b>{row.name}</b>
                        <div className="kpi-hub-muted">
                          {row.definition_code} · inherit Dictionary
                        </div>
                      </td>
                      <td>{row.owner}</td>
                      <td>{row.scope_name}</td>
                      <td>{dirLabel(row.direction)}</td>
                      <td>{row.target_label}</td>
                      <td>
                        {row.actual ?? '—'}{' '}
                        <PmQualityChip quality={row.quality} />
                      </td>
                      <td>
                        {row.quoted_vs_actual_pct != null ? (
                          row.quoted_delta_material && row.source_id ? (
                            <Link
                              href={`/crm/kpi-hub/reconcile?source=${row.source_id}`}
                              className="kpi-hub-form-error"
                              style={{ textDecoration: 'none' }}
                            >
                              {row.quoted_vs_actual_pct > 0 ? '+' : ''}
                              {row.quoted_vs_actual_pct}% vs {row.source_id}
                            </Link>
                          ) : (
                            <span className={row.quoted_vs_actual_pct > 10 ? 'kpi-hub-form-error' : ''}>
                              {row.quoted_vs_actual_pct > 0 ? '+' : ''}
                              {row.quoted_vs_actual_pct}%
                              {row.source_id ? ` vs ${row.source_id}` : ''}
                            </span>
                          )
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{progressLabel(row)}</td>
                      <td>
                        <span className={pmBadge(row.status)}>{statusLabel(row.status)}</span>
                      </td>
                      <td>
                        <Link
                          href={`/crm/kpi-hub/performance/check-ins?assignment=${row.id}`}
                          className="kpi-hub-btn kpi-hub-btn--ghost"
                        >
                          {row.status === 'red' ? 'Blocker' : 'Ritual'}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </>
      ) : null}
    </PmPage>
  );
}

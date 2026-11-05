'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import { fetchAePerformance, type AePerformanceBoard } from '@/lib/crm/ae-team-api';
import '@/app/crm/b2b/team/ae-team.css';

function count(value: number): string {
  return value ? String(value) : '—';
}

export function AePerformancePanel({ token }: { token: string }) {
  const [projectId, setProjectId] = useState('');
  const [data, setData] = useState<AePerformanceBoard | null>(null);
  const [error, setError] = useState('');
  const [hidden, setHidden] = useState(false);

  const load = useCallback(async (access: string, project = '') => {
    const board = await fetchAePerformance(access, project || undefined);
    setData(board);
    setError('');
    setHidden(false);
  }, []);

  useEffect(() => {
    if (!token) return;
    load(token, projectId).catch((err: unknown) => {
      if (err instanceof ApiError && (err.status === 403 || err.status === 401)) {
        setHidden(true);
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Không tải được hiệu suất AE');
    });
  }, [load, projectId, token]);

  if (hidden) return null;

  return (
    <section className="ae-team ae-perf-embed" aria-label="Hiệu suất theo Owner">
      <div className="ae-team-bar">
        <strong>Hiệu suất theo Owner</strong>
        <label>
          Dự án{' '}
          <select
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
          >
            <option value="">Mọi dự án</option>
            {(data?.projects ?? []).map((project) => (
              <option key={project.id} value={project.id}>{project.code}</option>
            ))}
          </select>
        </label>
        {data?.note ? <span className="ae-perf-note">{data.note}</span> : null}
      </div>
      {error ? <p className="ae-team-error">{error}</p> : null}
      {data ? (
        <>
          <div className="ae-perf-kpis">
            <div className="ae-perf-kpi"><span>Tổng lead</span><strong>{data.totals.total}</strong></div>
            <div className="ae-perf-kpi is-wait"><span>Chờ gắn dự án</span><strong>{data.totals.unassigned}</strong></div>
            <div className="ae-perf-kpi is-hot"><span>Hot</span><strong>{data.totals.hot}</strong></div>
            <div className="ae-perf-kpi is-sla"><span>Quá SLA</span><strong>{data.totals.sla_breach}</strong></div>
            <div className="ae-perf-kpi"><span>Chuyển đổi</span><strong>{data.totals.conversion_pct}%</strong></div>
            <div className="ae-perf-kpi"><span>Chốt</span><strong>{data.totals.won}</strong></div>
          </div>
          <div className="ae-team-panel">
            <div className="ae-perf-scroll">
              <table className="ae-perf-table">
                <thead>
                  <tr>
                    <th>Owner</th>
                    <th>Tổng</th>
                    <th>Theo dự án</th>
                    {data.stages.map((stage) => <th key={stage.id}>{stage.label}</th>)}
                    <th>Đang mở</th>
                    <th>Mất</th>
                    <th>Chốt</th>
                    <th>%</th>
                    <th>Quá SLA</th>
                    <th>Điểm TB</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.length === 0 ? (
                    <tr><td colSpan={10 + data.stages.length}>Chưa có AE trong phạm vi này.</td></tr>
                  ) : null}
                  {data.rows.map((row) => (
                    <tr key={row.staff_id}>
                      <td>
                        <span className="ae-perf-owner">{row.name}</span>
                        {row.code ? <span className="ae-perf-code"> ({row.code})</span> : null}
                      </td>
                      <td>{row.total}</td>
                      <td>
                        {row.projects.length
                          ? row.projects.map((project) => (
                            <span key={project.code} className="ae-perf-pill">{project.code}: {project.count}</span>
                          ))
                          : '—'}
                      </td>
                      {data.stages.map((stage) => (
                        <td key={stage.id} className={row.stages[stage.id] ? undefined : 'ae-perf-zero'}>
                          {count(row.stages[stage.id])}
                        </td>
                      ))}
                      <td>{row.open}</td>
                      <td className={row.lost ? undefined : 'ae-perf-zero'}>{count(row.lost)}</td>
                      <td>{row.won}</td>
                      <td>{row.conversion_pct}%</td>
                      <td className={row.sla_breach ? 'ae-perf-sla' : 'ae-perf-zero'}>{row.sla_breach}</td>
                      <td>{row.avg_score == null ? '—' : row.avg_score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}

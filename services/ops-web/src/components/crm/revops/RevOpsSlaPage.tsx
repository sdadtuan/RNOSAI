'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import {
  deleteRevopsSlaPolicy,
  fetchRevopsSlaCenter,
  type RevopsSlaCenterDto,
} from '@/lib/crm/revops-api';
import { useToast } from '@/lib/toast';
import { RevOpsQuickCreateButton, useRevopsModals } from './RevOpsModalsProvider';
import { useRevopsPage } from './RevOpsShell';

function statusTagClass(status: string): string {
  if (status === 'breached') return 'revops-tag revops-tag--red';
  if (status === 'warning') return 'revops-tag revops-tag--orange';
  return 'revops-tag revops-tag--blue';
}

function complianceClass(pct: number | null, target: number): string {
  if (pct == null) return 'revops-tag revops-tag--gray';
  if (pct >= target) return 'revops-tag revops-tag--green';
  if (pct >= target - 5) return 'revops-tag revops-tag--orange';
  return 'revops-tag revops-tag--red';
}

export function RevOpsSlaPage() {
  const { token } = useRevopsPage();
  const { openSlaPolicy, openAssign } = useRevopsModals();
  const { push } = useToast();
  const [data, setData] = useState<RevopsSlaCenterDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      setData(await fetchRevopsSlaCenter(token));
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Không tải được SLA center');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const handler = () => void load();
    window.addEventListener('revops-data-changed', handler);
    return () => window.removeEventListener('revops-data-changed', handler);
  }, [load]);

  async function onDeletePolicy(id: string, name: string) {
    if (!token || !window.confirm(`Xóa policy "${name}"?`)) return;
    try {
      await deleteRevopsSlaPolicy(token, id);
      push('Đã xóa policy', 'success');
      void load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'Không xóa được policy', 'error');
    }
  }

  const trendMax = Math.max(1, ...(data?.breachTrend7d.map((p) => p.count) ?? [1]));

  return (
    <>
      <header className="revops-page-head">
        <div>
          <h1>SLA & Escalation</h1>
          <p>Compliance lead first-response, handover accept và renewal prep.</p>
        </div>
        <div className="revops-page-actions">
          <button type="button" className="revops-btn" onClick={openSlaPolicy}>
            ＋ Policy
          </button>
          <RevOpsQuickCreateButton />
        </div>
      </header>

      {loading ? <p className="revops-muted">Đang tải…</p> : null}
      {error ? <p className="revops-error">{error}</p> : null}

      {data ? (
        <>
          <div className="revops-kpi-row">
            <div className="revops-kpi-card">
              <span className="revops-kpi-label">Compliance</span>
              <strong>{data.kpis.compliancePct != null ? `${data.kpis.compliancePct}%` : '—'}</strong>
              <span className={complianceClass(data.kpis.compliancePct, data.kpis.complianceTargetPct)}>
                Target {data.kpis.complianceTargetPct}%
              </span>
            </div>
            <div className="revops-kpi-card">
              <span className="revops-kpi-label">Warnings</span>
              <strong>{data.kpis.openWarnings}</strong>
            </div>
            <div className="revops-kpi-card">
              <span className="revops-kpi-label">Breaches</span>
              <strong>{data.kpis.breaches}</strong>
            </div>
            <div className="revops-kpi-card">
              <span className="revops-kpi-label">Auto reassign (7d)</span>
              <strong>{data.kpis.autoReassignments}</strong>
            </div>
          </div>

          <section className="revops-panel" style={{ marginTop: '1.5rem' }}>
            <h2>Hàng chờ incident</h2>
            {data.incidents.length === 0 ? (
              <p className="revops-muted">Không có incident mở.</p>
            ) : (
              <table className="revops-table">
                <thead>
                  <tr>
                    <th>Loại</th>
                    <th>Tiêu đề</th>
                    <th>Trạng thái</th>
                    <th>Due</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.incidents.map((row) => (
                    <tr key={row.id}>
                      <td>{row.entityType.replace(/_/g, ' ')}</td>
                      <td>{row.title}</td>
                      <td>
                        <span className={statusTagClass(row.status)}>{row.status}</span>
                      </td>
                      <td>{new Date(row.dueAt).toLocaleString('vi-VN')}</td>
                      <td>
                        {row.assignableLeadId ? (
                          <button
                            type="button"
                            className="revops-btn revops-btn--sm"
                            onClick={() =>
                              openAssign({
                                leadId: row.assignableLeadId!,
                                leadLabel: row.title,
                              })
                            }
                          >
                            Assign
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <div className="revops-grid-2 revops-section">
            <section className="revops-panel">
              <h2>Breach trend (7 ngày)</h2>
              {data.breachTrend7d.length === 0 ? (
                <p className="revops-muted">Chưa có breach trong 7 ngày.</p>
              ) : (
                <div className="revops-chart-bars">
                  {data.breachTrend7d.map((point) => (
                    <div key={point.day} className="revops-bar-group">
                      <div className="revops-bar-stack">
                        <div
                          className="revops-bar revops-bar--actual"
                          style={{ height: `${Math.max(8, Math.round((point.count / trendMax) * 100))}%` }}
                        />
                      </div>
                      <label>{point.day.slice(5)}</label>
                      <b>{point.count}</b>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="revops-panel">
              <h2>Policy catalog ({data.policies.length})</h2>
              {data.policies.length === 0 ? (
                <p className="revops-muted">Chưa có policy — tạo qua nút ＋ Policy.</p>
              ) : (
                <ul className="revops-list">
                  {data.policies.map((p) => (
                    <li key={p.id} className="revops-list-row">
                      <div>
                        {p.name} · {p.entityType} · {p.durationMinutes} phút
                      </div>
                      <button
                        type="button"
                        className="revops-btn revops-btn--sm"
                        onClick={() => void onDeletePolicy(p.id, p.name)}
                      >
                        Xóa
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      ) : null}
    </>
  );
}

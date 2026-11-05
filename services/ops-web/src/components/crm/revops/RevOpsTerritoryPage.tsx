'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import {
  deleteRevopsTerritory,
  fetchRevopsTerritoryCenter,
  simulateRevopsRouting,
  type RevopsRoutingRankedOwner,
  type RevopsTerritoryCenterDto,
} from '@/lib/crm/revops-api';
import { useToast } from '@/lib/toast';
import { RevOpsQuickCreateButton, useRevopsModals } from './RevOpsModalsProvider';
import { useRevopsPage } from './RevOpsShell';

function loadBarClass(pct: number | null): string {
  if (pct == null) return 'revops-progress';
  if (pct >= 90) return 'revops-progress revops-progress--orange';
  if (pct >= 100) return 'revops-progress revops-progress--red';
  return 'revops-progress';
}

export function RevOpsTerritoryPage() {
  const { token } = useRevopsPage();
  const { openTerritory, openRouting } = useRevopsModals();
  const { push } = useToast();
  const [data, setData] = useState<RevopsTerritoryCenterDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [simulateLeadId, setSimulateLeadId] = useState('');
  const [simulateOut, setSimulateOut] = useState<RevopsRoutingRankedOwner[]>([]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      setData(await fetchRevopsTerritoryCenter(token));
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Không tải được Territory center');
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

  async function runSimulate() {
    if (!token) return;
    const leadId = Number(simulateLeadId);
    try {
      const out = await simulateRevopsRouting(token, Number.isFinite(leadId) && leadId > 0 ? leadId : undefined);
      setSimulateOut(out.rankedOwners ?? []);
    } catch {
      setSimulateOut([]);
      push('Simulate thất bại', 'error');
    }
  }

  async function onDeleteTerritory(id: string, name: string) {
    if (!token || !window.confirm(`Xóa territory "${name}"?`)) return;
    try {
      await deleteRevopsTerritory(token, id);
      push('Đã xóa territory', 'success');
      void load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'Không xóa được territory', 'error');
    }
  }

  return (
    <>
      <header className="revops-page-head">
        <div>
          <h1>Territory & Capacity</h1>
          <p>Hierarchy territory, routing rules và simulate phân bổ lead.</p>
        </div>
        <div className="revops-page-actions">
          <button type="button" className="revops-btn" onClick={openTerritory}>
            ＋ Territory
          </button>
          <button type="button" className="revops-btn" onClick={openRouting}>
            Routing rule
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
              <span className="revops-kpi-label">Active territories</span>
              <strong>{data.kpis.activeTerritories}</strong>
            </div>
            <div className="revops-kpi-card">
              <span className="revops-kpi-label">Coverage gaps</span>
              <strong>{data.kpis.coverageGaps}</strong>
              <span className="revops-muted">Không có team owner</span>
            </div>
            <div className="revops-kpi-card">
              <span className="revops-kpi-label">Utilization</span>
              <strong>{data.kpis.utilizationPct != null ? `${data.kpis.utilizationPct}%` : '—'}</strong>
              <span className="revops-muted">TB load / capacity</span>
            </div>
          </div>

          <section className="revops-panel" style={{ marginTop: '1.5rem' }}>
            <h2>Territories</h2>
            {data.territories.length === 0 ? (
              <p className="revops-muted">Chưa có territory.</p>
            ) : (
              <table className="revops-table">
                <thead>
                  <tr>
                    <th>Tên</th>
                    <th>Hierarchy</th>
                    <th>Team</th>
                    <th>Load</th>
                    <th>Capacity bar</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.territories.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <b>{t.name}</b>
                        <div className="revops-sub">{t.type}</div>
                      </td>
                      <td>{t.parentName ?? '—'}</td>
                      <td>{t.teamLabel ?? '—'}</td>
                      <td>
                        {t.openLeads} leads · {t.namedAccounts} accounts
                      </td>
                      <td style={{ minWidth: '140px' }}>
                        {t.loadPct != null ? (
                          <>
                            <div className={loadBarClass(t.loadPct)}>
                              <span style={{ width: `${t.loadPct}%` }} />
                            </div>
                            <small className="revops-muted">{t.loadPct}%</small>
                          </>
                        ) : (
                          <span className="revops-muted">—</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="revops-btn revops-btn--sm"
                          onClick={() => void onDeleteTerritory(t.id, t.name)}
                        >
                          Xóa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="revops-panel" style={{ marginTop: '1rem' }}>
            <h2>Routing rules ({data.rules.length})</h2>
            {data.rules.length === 0 ? (
              <p className="revops-muted">Chưa có rule — seed sẽ tạo 4 rule mặc định khi mở trang.</p>
            ) : (
              <ul className="revops-list">
                {data.rules.map((r) => (
                  <li key={r.id}>
                    #{r.priority} {r.name} · {r.method} ·{' '}
                    <span className={r.status === 'published' ? 'revops-tag revops-tag--green' : 'revops-tag revops-tag--gray'}>
                      {r.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="revops-panel" style={{ marginTop: '1rem' }}>
            <h2>Simulate routing</h2>
            <div className="revops-inline-form">
              <input
                value={simulateLeadId}
                onChange={(ev) => setSimulateLeadId(ev.target.value)}
                placeholder="Lead ID"
              />
              <button type="button" className="revops-btn revops-btn--primary" onClick={() => void runSimulate()}>
                Simulate
              </button>
            </div>
            {simulateOut.length > 0 ? (
              <ol className="revops-list" style={{ marginTop: '0.75rem' }}>
                {simulateOut.map((o) => (
                  <li key={`${o.staffId}-${o.ruleName}`}>
                    {o.name} — score {o.score} · {o.ruleName}
                  </li>
                ))}
              </ol>
            ) : null}
          </section>
        </>
      ) : null}
    </>
  );
}

'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { fetchRevopsCommissionHub, type RevopsCommissionHubDto } from '@/lib/crm/revops-api';
import { formatRevopsVndCompact } from '@/lib/crm/revops-format';

const PROJECTION_LABELS = [
  { key: 'newVnd' as const, label: 'New', weightKey: 'newPct' as const },
  { key: 'renewalVnd' as const, label: 'Renewal', weightKey: 'renewalPct' as const },
  { key: 'upsellVnd' as const, label: 'Upsell', weightKey: 'upsellPct' as const },
  { key: 'slaVnd' as const, label: 'SLA', weightKey: 'slaPct' as const },
];

function payoutStep(status: string): number {
  if (status === 'reconciled') return 3;
  if (status === 'locked') return 2;
  if (status === 'draft') return 1;
  return 0;
}

type Props = {
  token: string;
  compact?: boolean;
};

export function SalesCommissionPanel({ token, compact = false }: Props) {
  const [data, setData] = useState<RevopsCommissionHubDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      setData(await fetchRevopsCommissionHub(token));
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Không tải được commission hub');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return (
      <article className="kpi-hub-card" data-testid="sales-commission-panel">
        <p className="cc-empty">Đang tải hoa hồng…</p>
      </article>
    );
  }

  if (error) {
    return (
      <article className="kpi-hub-card" data-testid="sales-commission-panel">
        <p className="error">{error}</p>
      </article>
    );
  }

  if (!data) return null;

  const latestBatch = data.payoutBatches[0];
  const step = latestBatch ? payoutStep(latestBatch.status) : 0;
  const maxProj = Math.max(1, ...PROJECTION_LABELS.map((p) => data.projections[p.key]));

  return (
    <article className="kpi-hub-card cc-commission-panel" data-testid="sales-commission-panel">
      <header className="kpi-hub-card__head">
        <div>
          <h2>Hoa hồng & Payout</h2>
          {data.activePlan ? (
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
              Plan: {data.activePlan.name} v{data.activePlan.version} · {data.activePlan.roleCode}
            </p>
          ) : (
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>Chưa có commission plan</p>
          )}
        </div>
        <div className="cc-commission-panel__actions">
          <Link href="/crm/revenue-ops/approvals?revops=1" className="kpi-hub-btn kpi-hub-btn--ghost">
            Approvals
          </Link>
          {!compact ? (
            <Link href="/crm/kpi-hub/commission?revops=1" className="kpi-hub-btn kpi-hub-btn--ghost">
              Chi tiết
            </Link>
          ) : null}
        </div>
      </header>

      <div className="cc-tiles" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        {PROJECTION_LABELS.map((p) => (
          <div key={p.key} className="kpi-hub-dash-card cc-tile">
            <span className="cc-metric-label">
              {p.label} {data.weights[p.weightKey]}%
            </span>
            <strong>{formatRevopsVndCompact(data.projections[p.key])}</strong>
            <div
              style={{
                marginTop: '0.35rem',
                height: '4px',
                background: '#e5e7eb',
                borderRadius: '999px',
                overflow: 'hidden',
              }}
            >
              <span
                style={{
                  display: 'block',
                  height: '100%',
                  width: `${Math.round((data.projections[p.key] / maxProj) * 100)}%`,
                  background: '#2563eb',
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="cc-row cc-row--3" style={{ marginTop: '1rem' }}>
        <div className="kpi-hub-dash-card cc-tile">
          <span className="cc-metric-label">Tạm tính</span>
          <strong>{formatRevopsVndCompact(data.summary.estimatedVnd)}</strong>
        </div>
        <div className="kpi-hub-dash-card cc-tile">
          <span className="cc-metric-label">Approved</span>
          <strong>{formatRevopsVndCompact(data.summary.approvedVnd)}</strong>
        </div>
        <div className="kpi-hub-dash-card cc-tile">
          <span className="cc-metric-label">Pending</span>
          <strong>{formatRevopsVndCompact(data.summary.pendingVnd)}</strong>
        </div>
      </div>

      {latestBatch ? (
        <section style={{ marginTop: '1.25rem' }}>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Payout {latestBatch.period}</h3>
          <ol style={{ display: 'flex', gap: '1rem', listStyle: 'none', padding: 0, margin: '0 0 0.5rem' }}>
            {['Draft', 'Locked', 'Reconciled'].map((label, idx) => {
              const active = step >= idx + 1;
              return (
                <li key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', opacity: active ? 1 : 0.45 }}>
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: active ? '#16a34a' : '#cbd5e1',
                    }}
                  />
                  {label}
                </li>
              );
            })}
          </ol>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
            Trạng thái: <strong>{latestBatch.status}</strong>
            {latestBatch.lockedAt ? ` · Locked ${new Date(latestBatch.lockedAt).toLocaleDateString('vi-VN')}` : ''}
          </p>
        </section>
      ) : null}

      {!compact ? (
        <>
          <section style={{ marginTop: '1.25rem' }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Theo nhân sự</h3>
            {data.staffRows.length === 0 ? (
              <p className="cc-empty">Chưa có giao dịch hoa hồng.</p>
            ) : (
              <div className="kpi-hub-table-wrap">
                <table className="kpi-hub-table">
                  <thead>
                    <tr>
                      <th>Nhân sự</th>
                      <th>Giao dịch</th>
                      <th>Tạm tính</th>
                      <th>Approved</th>
                      <th>Pending</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.staffRows.map((row) => (
                      <tr key={row.staffId}>
                        <td>{row.name}</td>
                        <td>{row.transactionCount}</td>
                        <td>{formatRevopsVndCompact(row.estimatedVnd)}</td>
                        <td>{formatRevopsVndCompact(row.approvedVnd)}</td>
                        <td>{formatRevopsVndCompact(row.pendingVnd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section style={{ marginTop: '1.25rem' }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Giao dịch gần đây</h3>
            {data.transactions.length === 0 ? (
              <p className="cc-empty">—</p>
            ) : (
              <div className="kpi-hub-table-wrap">
                <table className="kpi-hub-table">
                  <thead>
                    <tr>
                      <th>Deal</th>
                      <th>Staff</th>
                      <th>Eligible</th>
                      <th>Rate</th>
                      <th>Hoa hồng</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.transactions.slice(0, 20).map((tx) => (
                      <tr key={tx.id}>
                        <td>{tx.dealRef}</td>
                        <td>#{tx.staffId}</td>
                        <td>{formatRevopsVndCompact(tx.eligibleVnd)}</td>
                        <td>{tx.ratePct}%</td>
                        <td>{formatRevopsVndCompact(tx.commissionVnd)}</td>
                        <td>{tx.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </article>
  );
}

/** @deprecated use SalesCommissionPanel */
export function SalesCommissionStrip({ token }: { token: string }) {
  return <SalesCommissionPanel token={token} compact />;
}

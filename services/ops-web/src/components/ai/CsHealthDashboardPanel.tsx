'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { ChurnHealthClientView } from '@/lib/ai-api';
import { fetchChurnHealthDashboard, postChurnScore } from '@/lib/ai-api';

const BAND_LABELS: Record<string, string> = {
  healthy: 'Ổn định',
  watch: 'Theo dõi',
  at_risk: 'Rủi ro',
  critical: 'Nghiêm trọng',
};

export function CsHealthDashboardPanel({ token }: { token: string }) {
  const [rows, setRows] = useState<ChurnHealthClientView[]>([]);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState<'churn_risk' | 'score'>('churn_risk');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [ticketSpikeOnly, setTicketSpikeOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const out = await fetchChurnHealthDashboard(token, {
        sort,
        order,
        ticket_spike: ticketSpikeOnly,
        limit: 100,
      });
      setRows(out.data.clients);
      setTotal(out.data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải dashboard health thất bại');
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [token, sort, order, ticketSpikeOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleScan() {
    setScanning(true);
    setError('');
    try {
      await postChurnScore(token, { force: true, limit: 200 });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chấm churn thất bại');
    } finally {
      setScanning(false);
    }
  }

  return (
    <section className="cs-health-dashboard" data-testid="cs-health-dashboard">
      <div className="cs-health-dashboard__toolbar">
        <label>
          Sắp xếp
          <select value={sort} onChange={(e) => setSort(e.target.value as 'churn_risk' | 'score')}>
            <option value="churn_risk">Churn risk</option>
            <option value="score">Health score</option>
          </select>
        </label>
        <label>
          Thứ tự
          <select value={order} onChange={(e) => setOrder(e.target.value as 'asc' | 'desc')}>
            <option value="desc">Cao → thấp</option>
            <option value="asc">Thấp → cao</option>
          </select>
        </label>
        <label className="cs-health-dashboard__filter">
          <input
            type="checkbox"
            checked={ticketSpikeOnly}
            onChange={(e) => setTicketSpikeOnly(e.target.checked)}
          />
          Chỉ ticket spike
        </label>
        <button type="button" className="btn btn-secondary" disabled={scanning} onClick={() => void handleScan()}>
          {scanning ? 'Đang chấm…' : 'Chấm churn (batch)'}
        </button>
      </div>

      {error ? <p className="cs-health-dashboard__error">{error}</p> : null}
      {loading ? <p className="muted">Đang tải…</p> : null}

      {!loading ? (
        <p className="muted cs-health-dashboard__meta">{total} client · UI-R3-04</p>
      ) : null}

      <div className="cs-health-dashboard__table-wrap">
        <table className="perf-table cs-health-table" data-testid="cs-health-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Score</th>
              <th>Churn risk</th>
              <th>Band</th>
              <th>Ticket spike</th>
              <th>Ticket mở</th>
              <th>Quá hạn TT</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.score_id} data-testid={`health-row-${row.client_id}`}>
                <td>
                  <strong>{row.client_name}</strong>
                  <div className="muted">{row.client_code}</div>
                </td>
                <td>{row.health.health_score}</td>
                <td>{row.health.churn_risk_pct}%</td>
                <td>
                  <span className={`health-band health-band--${row.health.health_band}`}>
                    {BAND_LABELS[row.health.health_band] ?? row.health.health_band}
                  </span>
                </td>
                <td>{row.health.ticket_spike ? 'Có' : '—'}</td>
                <td>{row.health.signals.tickets_open}</td>
                <td>{Math.round(row.health.signals.payment_overdue_vnd).toLocaleString('vi-VN')} ₫</td>
                <td>
                  <Link href={`/agency/clients/${row.client_id}?tab=health`} className="btn btn-link">
                    Chi tiết
                  </Link>
                  {row.health.renewal_recommended ? (
                    <>
                      {' · '}
                      <Link href={`/agency/clients/${row.client_id}?tab=retain`} className="btn btn-link">
                        Retain
                      </Link>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="muted">
                  Chưa có health score — chạy batch scan hoặc chờ cron nightly.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

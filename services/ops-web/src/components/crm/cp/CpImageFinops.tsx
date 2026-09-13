'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { formatCpApiError } from '@/lib/crm/cp-api';
import { getCpImageFinopsSummary, type CpImageFinopsSummary } from '@/lib/crm/cp-image-sop-api';
import { dash } from '@/lib/crm/cp-format';

const EMPTY: CpImageFinopsSummary = {
  charged: null,
  reserved: null,
  cost_per_approved: null,
  anomalies: null,
  by_provider: [],
};

export function CpImageFinops() {
  const [summary, setSummary] = useState<CpImageFinopsSummary>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setSummary(await getCpImageFinopsSummary(token));
    } catch (err) {
      setError(formatCpApiError(err, 'Không tải được FinOps'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="cp-overview" aria-busy={loading}>
      <header className="cp-overview__head">
        <div>
          <p className="cp-crumb">Ảnh SOP / <b>AI FinOps</b></p>
          <h1>AI FinOps &amp; Margin</h1>
          <p className="cp-muted">crm_cp_credit_ledger · không USD giả — hiển thị credit VND nội bộ.</p>
          <p className="cp-sot">GET /api/crm/cp/image/finops/summary</p>
        </div>
      </header>

      {error ? (
        <section className="cp-card cp-card--error">
          <p>{error}</p>
        </section>
      ) : null}

      <div className="cp-img-tiles">
        <article className="cp-img-tile">
          <span>Credit charged (image_sop)</span>
          <strong>{dash(summary.charged)}</strong>
          <em>SUM ledger WHERE source image_sop</em>
        </article>
        <article className="cp-img-tile">
          <span>Reserved</span>
          <strong>{dash(summary.reserved)}</strong>
        </article>
        <article className="cp-img-tile">
          <span>Cost / approved</span>
          <strong>{dash(summary.cost_per_approved)}</strong>
        </article>
        <article className="cp-img-tile">
          <span>Anomalies</span>
          <strong>{dash(summary.anomalies)}</strong>
        </article>
      </div>

      <section className="cp-card">
        <header className="cp-card__head">
          <h2>Cost by provider</h2>
        </header>
        <div className="cp-table-wrap">
          <table className="cp-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Generated</th>
                <th>Approved</th>
                <th>Credit</th>
              </tr>
            </thead>
            <tbody>
              {summary.by_provider.length === 0 ? (
                <tr>
                  <td colSpan={4} className="cp-muted" style={{ textAlign: 'center', padding: 20 }}>
                    — · join crm_cp_provider_runs + ledger
                  </td>
                </tr>
              ) : (
                summary.by_provider.map((row) => (
                  <tr key={row.provider}>
                    <td>{row.provider}</td>
                    <td>{dash(row.generated)}</td>
                    <td>{dash(row.approved)}</td>
                    <td>{dash(row.credits)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="cp-img-note">
          Budget guard: 50/80/100% · ledger theo <b>từng stage</b> (<code>source=image_sop:{'{stage}'}</code>)
          · cap <code>crm_img.finance</code>.
        </p>
      </section>
    </div>
  );
}

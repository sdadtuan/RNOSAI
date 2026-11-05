'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { formatCpApiError } from '@/lib/crm/cp-api';
import { getCpImageGovernanceAudit, type CpImageAuditItem } from '@/lib/crm/cp-image-sop-api';
import { dash } from '@/lib/crm/cp-format';

const POLICIES = [
  { policy: 'External Processing', condition: 'data_class = RESTRICTED', enforcement: 'BLOCK external · Comfy only' },
  { policy: 'Magnific Cost Guard', condition: 'estimate > threshold', enforcement: 'Confirm + reserve (GT-I04)' },
  { policy: 'Hub delivery', condition: 'before G3', enforcement: 'BLOCK (GT-I06)' },
  { policy: 'Logo/CTA overlay', condition: 'intent = text_cta hoặc lockup required', enforcement: 'BLOCK model-drawn (GT-I09)' },
  { policy: 'Format pack', condition: 'G3 / Hub', enforcement: 'BLOCK nếu thiếu tỉ lệ (GT-I10)' },
  { policy: 'Winner select', condition: 'trước refine/upscale', enforcement: '409 (GT-I11)' },
];

export function CpImageGovernance() {
  const [audit, setAudit] = useState<CpImageAuditItem[]>([]);
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
      const out = await getCpImageGovernanceAudit(token);
      setAudit(out.items);
    } catch (err) {
      setError(formatCpApiError(err, 'Không tải được governance'));
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
          <p className="cp-crumb">Ảnh SOP / <b>Governance</b></p>
          <h1>Governance, Policy &amp; Audit</h1>
          <p className="cp-muted">RBAC crm_img.* · audit append-only · policy JSON versioned.</p>
          <p className="cp-sot">GET /api/crm/cp/image/governance/audit</p>
        </div>
      </header>

      {error ? (
        <section className="cp-card cp-card--error">
          <p>{error}</p>
        </section>
      ) : null}

      <div className="cp-img-grid2">
        <section className="cp-card">
          <header className="cp-card__head">
            <h2>Control coverage</h2>
            <span className="cp-pill cp-pill--ok">Target 100%</span>
          </header>
          <div className="cp-img-metric">
            <span>RBAC evaluated</span>
            <div className="cp-progress">
              <i style={{ width: '100%' }} />
            </div>
            <b>100%</b>
          </div>
          <div className="cp-img-metric">
            <span>Cost estimate jobs</span>
            <div className="cp-progress">
              <i style={{ width: '0%' }} />
            </div>
            <b>{dash(null)}</b>
          </div>
          <div className="cp-img-metric">
            <span>Provenance complete</span>
            <div className="cp-progress">
              <i style={{ width: '0%' }} />
            </div>
            <b>{dash(null)}</b>
          </div>
        </section>

        <section className="cp-card">
          <header className="cp-card__head">
            <h2>Recent audit</h2>
          </header>
          <div className="cp-img-feed">
            {audit.length === 0 ? (
              <p className="cp-muted">—</p>
            ) : (
              audit.map((item) => (
                <div key={`${item.at}-${item.title}`} className="cp-img-feeditem">
                  <div className="cp-img-ficon">◈</div>
                  <div>
                    <b>{item.title}</b>
                    <p>{item.detail}</p>
                  </div>
                  <time>{item.at}</time>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="cp-card">
        <header className="cp-card__head">
          <h2>Policy-as-Code (v2.8.1 target)</h2>
        </header>
        <div className="cp-table-wrap">
          <table className="cp-table">
            <thead>
              <tr>
                <th>Policy</th>
                <th>Condition</th>
                <th>Enforcement</th>
              </tr>
            </thead>
            <tbody>
              {POLICIES.map((row) => (
                <tr key={row.policy}>
                  <td>{row.policy}</td>
                  <td>{row.condition}</td>
                  <td>{row.enforcement}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

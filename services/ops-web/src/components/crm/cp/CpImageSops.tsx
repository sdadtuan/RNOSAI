'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { formatCpApiError } from '@/lib/crm/cp-api';
import { listCpImageSops, type CpImageSop } from '@/lib/crm/cp-image-sop-api';
import { dash } from '@/lib/crm/cp-format';

function sopStatusClass(status: string): string {
  const upper = status.toUpperCase();
  if (upper === 'STAGING') return 'cp-pill cp-pill--warn';
  if (upper === 'BLOCKED') return 'cp-pill cp-pill--warn';
  if (upper === 'DRAFT') return 'cp-pill cp-pill--info';
  return 'cp-pill cp-pill--ok';
}

export function CpImageSops() {
  const [sops, setSops] = useState<CpImageSop[]>([]);
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
      const out = await listCpImageSops(token);
      setSops(out.items);
    } catch (err) {
      setError(formatCpApiError(err, 'Không tải được SOP registry'));
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
          <p className="cp-crumb">Ảnh SOP / <b>SOP Registry</b></p>
          <h1>Enterprise SOP Registry</h1>
          <p className="cp-muted">SOP-as-Code · img_sop_registry · img_sop_versions.</p>
          <p className="cp-sot">GET /api/crm/cp/image/sops</p>
        </div>
        <div className="cp-overview__actions">
          <Link className="cp-btn cp-btn--primary" href="/crm/creative-os/image/sops/new">
            ＋ Tạo SOP
          </Link>
        </div>
      </header>

      {error ? (
        <section className="cp-card cp-card--error">
          <p>{error}</p>
        </section>
      ) : null}

      <div className="cp-img-sopgrid">
        {sops.length === 0 ? (
          <p className="cp-muted">— · Chưa có SOP seed</p>
        ) : (
          sops.map((sop, index) => (
            <article key={sop.code} className="cp-img-sop">
              <div className={`cp-img-sop__thumb${index % 3 === 1 ? ' cp-img-sop__thumb--two' : index % 3 === 2 ? ' cp-img-sop__thumb--three' : ''}`} />
              <div className="cp-img-sop__body">
                <h4>{sop.name}</h4>
                <p>
                  <code>{sop.code}</code>
                  {sop.intent ? ` · intent ${sop.intent}` : ''}
                </p>
                <div className="cp-img-sopmeta">
                  <span className={sopStatusClass(sop.status)}>{sop.status}</span>
                  <span>{dash(sop.version)}</span>
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      <section className="cp-card">
        <header className="cp-card__head">
          <h2>SOP portfolio health</h2>
        </header>
        <div className="cp-table-wrap">
          <table className="cp-table">
            <thead>
              <tr>
                <th>SOP</th>
                <th>Lifecycle</th>
                <th>Quality</th>
                <th>Cost/Approved</th>
                <th>Health</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="cp-muted" style={{ textAlign: 'center', padding: 20 }}>
                  — · metrics khi có production runs
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

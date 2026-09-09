'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PmPage, pmBadge } from '@/components/kpi-hub/performance/PmPage';
import { PmPageState } from '@/components/kpi-hub/performance/PmPageState';
import { ServiceKpiSummaryTiles } from '@/components/kpi-hub/service-kpi/ServiceKpiSummaryTiles';
import { getAccessToken } from '@/lib/auth';
import { fetchPmMarketing } from '@/lib/performance-api';
import type { PmMarketing } from '@/lib/performance-types';

const EMPTY: PmMarketing = {
  spend: '—',
  valid_leads: 0,
  cpl: 0,
  mql_rate: 0,
  roas: { value: null, display: 'N/A', reason: 'Thiếu attribution model' },
  sources: [],
  at_risk: [],
};

export default function PerformanceMarketingPage() {
  const token = getAccessToken() ?? '';
  const [data, setData] = useState<PmMarketing>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    void fetchPmMarketing(token)
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không tải marketing'))
      .finally(() => setLoading(false));
  }, [token]);

  const crmStale = data.sources.some((s) => /stale/i.test(s.health));

  return (
    <PmPage
      title="Marketing OS"
      subtitle="PM-07 · Source health bắt buộc. ROAS = N/A nếu attribution thiếu — không bịa số đẹp."
      crumb="Marketing OS"
      actions={
        <>
          <Link href="/crm/kpi-hub/performance/campaigns" className="kpi-hub-btn kpi-hub-btn--ghost">
            Campaign Control
          </Link>
          <Link href="/crm/kpi-hub/marketing" className="kpi-hub-btn kpi-hub-btn--primary">
            Command Center
          </Link>
        </>
      }
    >
      <PmPageState loading={loading} error={error} />
      {!loading && !error ? (
        <>
          <ServiceKpiSummaryTiles
            tiles={[
              { label: 'MEDIA SPEND', value: data.spend, hint: 'Maintain vs plan 320M' },
              {
                label: 'VALID LEADS',
                value: data.valid_leads.toLocaleString('vi-VN'),
                hint: crmStale ? 'CRM stale → Pending' : undefined,
                tone: crmStale ? 'warn' : 'default',
              },
              {
                label: 'CPL VALID',
                value: `${data.cpl.toLocaleString('vi-VN')} ₫`,
                hint: 'Tile tổng; An Phát riêng Critical',
                tone: 'warn',
              },
              {
                label: 'MQL RATE',
                value: `${data.mql_rate}%`,
                hint: 'Target ≥16%',
                tone: 'ok',
              },
              {
                label: 'ROAS',
                value: data.roas.display,
                hint: data.roas.reason ?? undefined,
                tone: data.roas.value == null ? 'warn' : 'ok',
              },
            ]}
          />
          <div className="kpi-hub-pm-layout" style={{ marginTop: 16 }}>
            <article className="kpi-hub-card">
              <header className="kpi-hub-card__head">
                <h2>At risk</h2>
              </header>
              <ul className="kpi-hub-pm-list">
                {data.at_risk.map((r) => (
                  <li key={r.title}>
                    <span>
                      {r.title} {r.actual}
                    </span>
                    <span className={pmBadge(r.status)}>{r.status === 'red' ? 'Critical' : 'Watch'}</span>
                  </li>
                ))}
                {data.roas.value == null ? (
                  <li>
                    <span>ROAS bị ẩn — không đủ model</span>
                    <span className="kpi-hub-badge kpi-hub-badge--purple">Policy</span>
                  </li>
                ) : null}
              </ul>
            </article>
            <aside className="kpi-hub-pm-aside">
              <article className="kpi-hub-card">
                <header className="kpi-hub-card__head">
                  <h2>Source health</h2>
                </header>
                <ul className="kpi-hub-pm-list">
                  {data.sources.map((s) => (
                    <li key={s.name}>
                      <span>{s.name}</span>
                      <span className={pmBadge(/stale/i.test(s.health) ? 'yellow' : 'green')}>{s.health}</span>
                    </li>
                  ))}
                </ul>
              </article>
            </aside>
          </div>
        </>
      ) : null}
    </PmPage>
  );
}

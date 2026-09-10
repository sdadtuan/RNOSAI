'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PmPage, pmBadge } from '@/components/kpi-hub/performance/PmPage';
import { PmPageState } from '@/components/kpi-hub/performance/PmPageState';
import { PmSummaryTiles } from '@/components/kpi-hub/performance/PmSummaryTiles';
import { PmAmberNotice } from '@/components/kpi-hub/performance/PmMoatNotice';
import { getAccessToken } from '@/lib/auth';
import { PM_SUBTITLES } from '@/lib/performance-copy';
import { fetchPmCampaigns } from '@/lib/performance-api';
import type { PmCampaigns } from '@/lib/performance-types';

const EMPTY: PmCampaigns = { items: [], funnel: [] };

function statusLabel(status: string) {
  if (status === 'green') return 'On Track';
  if (status === 'red') return 'At Risk';
  if (status === 'yellow') return 'Watch';
  return status;
}

export default function PerformanceCampaignsPage() {
  const token = getAccessToken() ?? '';
  const [data, setData] = useState<PmCampaigns>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    void fetchPmCampaigns(token)
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không tải campaign'))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <PmPage
      title="Campaign Control"
      subtitle={PM_SUBTITLES.campaign}
      crumb="Campaign Control"
      actions={
        <Link href="/crm/kpi-hub/performance/marketing" className="kpi-hub-btn kpi-hub-btn--ghost">
          Marketing OS
        </Link>
      }
    >
      <PmPageState loading={loading} error={error} empty={!loading && !error && !data.items.length} />
      {!loading && !error ? (
        <>
          <PmAmberNotice>
            Media budget và agency fee tách sổ — client report không lẫn fee/margin nội bộ.
          </PmAmberNotice>
          <article className="kpi-hub-card">
            <div className="kpi-hub-card__body" style={{ overflowX: 'auto' }}>
              <table className="kpi-hub-table">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Client</th>
                    <th>Quote / WO</th>
                    <th>KPI</th>
                    <th>Quoted</th>
                    <th>Actual</th>
                    <th>Media</th>
                    <th>Fee</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => (
                    <tr key={`${row.campaign}-${row.kpi}`}>
                      <td>{row.campaign}</td>
                      <td>{row.client}</td>
                      <td>{row.quote_wo}</td>
                      <td>{row.kpi}</td>
                      <td>{row.quoted}</td>
                      <td>{row.actual}</td>
                      <td>{row.media_budget}</td>
                      <td>{row.agency_fee}</td>
                      <td>
                        <span className={pmBadge(row.status)}>{statusLabel(row.status)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
          <div className="kpi-hub-pm-layout" style={{ marginTop: 16 }}>
            <article className="kpi-hub-card">
              <header className="kpi-hub-card__head">
                <h2>Funnel — Growth Launch Q4</h2>
                <span className="kpi-hub-muted">Stage thiếu source = empty</span>
              </header>
              <div className="kpi-hub-card__body">
                <PmSummaryTiles
                  cols={4}
                  tiles={data.funnel.map((f) => ({
                    label: f.label,
                    value: f.display,
                    hint: f.hint,
                    tone: f.display === '—' ? 'warn' : f.hint?.includes('Pending') ? 'warn' : 'default',
                  }))}
                />
              </div>
            </article>
            <aside className="kpi-hub-pm-aside">
              <article className="kpi-hub-card">
                <header className="kpi-hub-card__head">
                  <h2>Dependencies</h2>
                </header>
                <div className="kpi-hub-card__body">
                  <p className="kpi-hub-muted">
                    Media pacing, creative cadence, LP live, valid-lead rule v3, Sales SLA. Client report ẩn fee/margin.
                  </p>
                </div>
              </article>
            </aside>
          </div>
        </>
      ) : null}
    </PmPage>
  );
}

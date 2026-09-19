'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PmMoatNotice } from '@/components/kpi-hub/performance/PmMoatNotice';
import { PmPage, pmBadge } from '@/components/kpi-hub/performance/PmPage';
import { PmPageState } from '@/components/kpi-hub/performance/PmPageState';
import { PmSummaryTiles } from '@/components/kpi-hub/performance/PmSummaryTiles';
import { getAccessToken } from '@/lib/auth';
import { PM_SUBTITLES } from '@/lib/performance-copy';
import { fetchPmCrmSource, refreshPmCrmSource } from '@/lib/performance-api';
import type { PmCrmSource } from '@/lib/performance-types';

const EMPTY: PmCrmSource = { tiles: [], mappings: [] };

export default function PerformanceCrmSourcePage() {
  const token = getAccessToken() ?? '';
  const [data, setData] = useState<PmCrmSource>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const next = await fetchPmCrmSource(token);
      setData(next);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không tải CRM source');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRefresh = async () => {
    if (!token) return;
    setRefreshing(true);
    setNotice(null);
    try {
      const next = await refreshPmCrmSource(token);
      setData(next);
      setNotice('Đã sync CRM mapping — Valid Lead hết stale.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không refresh được');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <PmPage
      title="CRM Source Map"
      subtitle={PM_SUBTITLES.crm}
      crumb="CRM Source Map"
      actions={
        <>
          <Link href="/crm/kpi-hub/measurement" className="kpi-hub-btn kpi-hub-btn--ghost">
            Measurement Plan
          </Link>
          <button
            type="button"
            className="kpi-hub-btn kpi-hub-btn--primary"
            disabled={refreshing || !token}
            onClick={() => void handleRefresh()}
          >
            {refreshing ? 'Đang sync…' : 'Refresh / Sync CRM'}
          </button>
        </>
      }
    >
      <PmMoatNotice>
        <b>AC-PM-04:</b> Valid Lead stale → KPI phụ thuộc (CPL, MQL Rate) = Pending Validation. Period close bị
        chặn. Bấm <b>Refresh / Sync CRM</b> trước Activate.
      </PmMoatNotice>
      {notice ? <p className="kpi-hub-muted">{notice}</p> : null}
      <PmPageState loading={loading} error={error} empty={!loading && !error && !data.mappings.length} />
      {!loading && !error ? (
        <>
          <PmSummaryTiles
            cols={5}
            tiles={data.tiles.map((t) => ({
              label: t.label,
              value: t.value,
              hint: t.hint,
              tone: t.tone === 'critical' ? 'critical' : /stale|amber/i.test(t.hint) ? 'warn' : t.tone === 'ok' ? 'ok' : 'default',
            }))}
          />
          <article className="kpi-hub-card" style={{ marginTop: 16 }}>
            <div className="kpi-hub-card__body" style={{ overflowX: 'auto' }}>
              <table className="kpi-hub-table">
                <thead>
                  <tr>
                    <th>KPI</th>
                    <th>Rule (versioned)</th>
                    <th>Field</th>
                    <th>Cadence</th>
                    <th>Quality</th>
                    <th>Dependent PM KPI</th>
                  </tr>
                </thead>
                <tbody>
                  {data.mappings.map((m) => (
                    <tr key={m.kpi}>
                      <td>{m.kpi}</td>
                      <td>{m.definition}</td>
                      <td>{m.field}</td>
                      <td>{m.cadence}</td>
                      <td>
                        <span className={pmBadge(/stale/i.test(m.quality) ? 'yellow' : 'green')}>{m.quality}</span>
                      </td>
                      <td>{m.related}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </>
      ) : null}
    </PmPage>
  );
}

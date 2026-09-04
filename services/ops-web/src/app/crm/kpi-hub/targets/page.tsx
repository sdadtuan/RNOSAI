'use client';

import { useEffect, useState } from 'react';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { KpiHubTargetCards } from '@/components/kpi-hub/targets/KpiHubTargetCards';
import { KpiHubTargetDrawer } from '@/components/kpi-hub/targets/KpiHubTargetDrawer';
import { KpiHubTargetTable } from '@/components/kpi-hub/targets/KpiHubTargetTable';
import { getAccessToken } from '@/lib/auth';
import { fetchKpiHubTargets } from '@/lib/kpi-hub-api';
import { KPI_HUB_TARGETS } from '@/lib/kpi-hub-fixtures';
import { normalizeTargets } from '@/lib/kpi-hub-normalize';
import type { KpiHubTargetsData } from '@/lib/kpi-hub-types';

export default function KpiHubTargetsPage() {
  const token = getAccessToken() ?? '';
  const [selected, setSelected] = useState<string | null>('t1');
  const [data, setData] = useState<KpiHubTargetsData>(KPI_HUB_TARGETS as KpiHubTargetsData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchKpiHubTargets(token)
      .then((raw) => {
        if (!cancelled) setData(normalizeTargets(raw as Record<string, unknown>));
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Không tải được target');
          setData(KPI_HUB_TARGETS as KpiHubTargetsData);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const selectedRow = data.rows.find((r) => r.id === selected) ?? null;

  return (
    <KpiHubPageGate section="crm_kpi_hub_targets">
      <KpiHubShell
        title="Target & Cảnh báo"
        subtitle="Thiết lập target và quy tắc cảnh báo theo KPI"
        breadcrumb={[{ label: 'KPI Hub' }, { label: 'Target & Cảnh báo' }]}
        actions={
          <>
            <button type="button" className="kpi-hub-btn kpi-hub-btn--primary">
              + Thiết lập Target
            </button>
            <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost">
              Quy tắc cảnh báo
            </button>
          </>
        }
      >
        {error ? <p className="error">{error}</p> : null}
        <div className={`kpi-hub-page-with-drawer${selected ? ' has-drawer' : ''}`}>
          <div className="kpi-hub-page-with-drawer__main">
            <KpiHubTargetCards summary={data.summary} loading={loading} />
            {loading ? (
              <div className="kpi-hub-table-wrap kpi-hub-skeleton-table">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="kpi-hub-skeleton kpi-hub-skeleton--line" />
                ))}
              </div>
            ) : (
              <KpiHubTargetTable rows={data.rows} selectedId={selected} onSelect={setSelected} />
            )}
          </div>
          <KpiHubTargetDrawer
            row={selectedRow}
            onClose={() => setSelected(null)}
            onSaved={(updated) => {
              setData((prev) => ({
                ...prev,
                rows: prev.rows.map((r) => (r.id === updated.id ? updated : r)),
              }));
            }}
          />
        </div>
      </KpiHubShell>
    </KpiHubPageGate>
  );
}

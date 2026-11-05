'use client';

import { useEffect, useState } from 'react';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { KpiHubSettingsNav } from '@/components/kpi-hub/settings/KpiHubSettingsNav';
import { QuickToggles } from '@/components/kpi-hub/settings/QuickToggles';
import { SystemStatusRail } from '@/components/kpi-hub/settings/SystemStatusRail';
import { WorkspacePanel } from '@/components/kpi-hub/settings/WorkspacePanel';
import { getAccessToken } from '@/lib/auth';
import { fetchKpiHubWorkspace } from '@/lib/kpi-hub-api';
import { KPI_HUB_WORKSPACE } from '@/lib/kpi-hub-fixtures';
import { normalizeWorkspace } from '@/lib/kpi-hub-normalize';

type WorkspaceData = ReturnType<typeof normalizeWorkspace>;

export default function KpiHubSettingsPage() {
  const token = getAccessToken() ?? '';
  const [nav, setNav] = useState('Không gian làm việc');
  const [workspace, setWorkspace] = useState<WorkspaceData>(KPI_HUB_WORKSPACE);
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
    void fetchKpiHubWorkspace(token)
      .then((raw) => {
        if (!cancelled) setWorkspace(normalizeWorkspace(raw));
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Không tải được cài đặt');
          setWorkspace(KPI_HUB_WORKSPACE);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <KpiHubPageGate section="crm_kpi_hub_settings">
      <KpiHubShell
        title="Cài đặt"
        subtitle="Cấu hình workspace, chu kỳ và tích hợp KPI Hub"
        breadcrumb={[{ label: 'KPI Hub' }, { label: 'Cài đặt' }]}
      >
        {error ? <p className="error">{error}</p> : null}
        <div className="kpi-hub-settings-layout">
          <KpiHubSettingsNav active={nav} onSelect={setNav} />
          <div className="kpi-hub-settings-layout__body">
            <div className="kpi-hub-tab-panel kpi-hub-tab-panel--split">
              <div className="kpi-hub-tab-panel__main">
                {nav === 'Không gian làm việc' ? (
                  <WorkspacePanel workspace={workspace} loading={loading} />
                ) : (
                  <section className="kpi-hub-card">
                    <h2>{nav}</h2>
                    <p className="muted">Nội dung {nav} sẽ được bổ sung ở các sóng tiếp theo.</p>
                  </section>
                )}
              </div>
              <div className="kpi-hub-rail">
                <SystemStatusRail />
                <QuickToggles />
              </div>
            </div>
          </div>
        </div>
      </KpiHubShell>
    </KpiHubPageGate>
  );
}

'use client';

import { useState } from 'react';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { KpiHubSettingsNav } from '@/components/kpi-hub/settings/KpiHubSettingsNav';
import { QuickToggles } from '@/components/kpi-hub/settings/QuickToggles';
import { SystemStatusRail } from '@/components/kpi-hub/settings/SystemStatusRail';
import { WorkspacePanel } from '@/components/kpi-hub/settings/WorkspacePanel';

export default function KpiHubSettingsPage() {
  const [nav, setNav] = useState('Không gian làm việc');

  return (
    <KpiHubPageGate section="crm_kpi_hub_settings">
      <KpiHubShell
        title="Cài đặt"
        subtitle="Cấu hình workspace, chu kỳ và tích hợp KPI Hub"
        breadcrumb={[{ label: 'KPI Hub' }, { label: 'Cài đặt' }]}
      >
        <div className="kpi-hub-settings-layout">
          <KpiHubSettingsNav active={nav} onSelect={setNav} />
          <div className="kpi-hub-settings-layout__body">
            <div className="kpi-hub-tab-panel kpi-hub-tab-panel--split">
              <div className="kpi-hub-tab-panel__main">
                {nav === 'Không gian làm việc' ? (
                  <WorkspacePanel />
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

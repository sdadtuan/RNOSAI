'use client';

import { useState } from 'react';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { KpiHubTargetCards } from '@/components/kpi-hub/targets/KpiHubTargetCards';
import { KpiHubTargetDrawer } from '@/components/kpi-hub/targets/KpiHubTargetDrawer';
import { KpiHubTargetTable } from '@/components/kpi-hub/targets/KpiHubTargetTable';

export default function KpiHubTargetsPage() {
  const [selected, setSelected] = useState<string | null>('t1');

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
        <div className={`kpi-hub-page-with-drawer${selected ? ' has-drawer' : ''}`}>
          <div className="kpi-hub-page-with-drawer__main">
            <KpiHubTargetCards />
            <KpiHubTargetTable selectedId={selected} onSelect={setSelected} />
          </div>
          <KpiHubTargetDrawer targetId={selected} onClose={() => setSelected(null)} />
        </div>
      </KpiHubShell>
    </KpiHubPageGate>
  );
}

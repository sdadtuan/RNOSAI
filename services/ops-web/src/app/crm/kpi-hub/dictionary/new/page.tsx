'use client';

import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { KpiHubEditorChrome, useKpiHubEditorTab } from '@/components/kpi-hub/dictionary/KpiHubEditorChrome';
import { OverviewTab } from '@/components/kpi-hub/dictionary/tabs/OverviewTab';
import { GovernanceTab } from '@/components/kpi-hub/dictionary/tabs/GovernanceTab';
import { TargetTab } from '@/components/kpi-hub/dictionary/tabs/TargetTab';
import { KpiHubFormulaTab } from '@/components/kpi-hub/formula/KpiHubFormulaTab';
import { KpiHubMappingTab } from '@/components/kpi-hub/mapping/KpiHubMappingTab';
import { KPI_HUB_DICTIONARY } from '@/lib/kpi-hub-fixtures';

const DRAFT_ROW = {
  ...KPI_HUB_DICTIONARY[0],
  id: 'new',
  code: '',
  name: 'KPI mới',
  status: 'DRAFT' as const,
};

function EditorBody() {
  const tab = useKpiHubEditorTab();
  const row = DRAFT_ROW;
  if (tab === 'formula') return <KpiHubFormulaTab />;
  if (tab === 'source') return <KpiHubMappingTab />;
  if (tab === 'target') return <TargetTab row={row} />;
  if (tab === 'governance') return <GovernanceTab row={row} />;
  return <OverviewTab row={row} />;
}

export default function KpiHubDictionaryNewPage() {
  return (
    <KpiHubPageGate section="crm_kpi_dictionary">
      <KpiHubShell
        title="Tạo KPI"
        subtitle="Thêm chỉ tiêu mới vào Dictionary"
        breadcrumb={[
          { label: 'KPI Dictionary', href: '/crm/kpi-hub/dictionary' },
          { label: 'Tạo mới' },
        ]}
      >
        <KpiHubEditorChrome
          row={DRAFT_ROW}
          breadcrumb={[
            { label: 'KPI Dictionary', href: '/crm/kpi-hub/dictionary' },
            { label: 'Tạo mới' },
          ]}
        >
          <EditorBody />
        </KpiHubEditorChrome>
      </KpiHubShell>
    </KpiHubPageGate>
  );
}

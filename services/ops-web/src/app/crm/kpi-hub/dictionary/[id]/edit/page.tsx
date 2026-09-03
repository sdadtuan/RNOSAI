'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { KpiHubEditorChrome, useKpiHubEditorTab } from '@/components/kpi-hub/dictionary/KpiHubEditorChrome';
import { OverviewTab } from '@/components/kpi-hub/dictionary/tabs/OverviewTab';
import { GovernanceTab } from '@/components/kpi-hub/dictionary/tabs/GovernanceTab';
import { TargetTab } from '@/components/kpi-hub/dictionary/tabs/TargetTab';
import { KpiHubFormulaTab } from '@/components/kpi-hub/formula/KpiHubFormulaTab';
import { KpiHubMappingTab } from '@/components/kpi-hub/mapping/KpiHubMappingTab';
import { findDictionaryById } from '@/lib/kpi-hub-fixtures';

function EditorBody({ id }: { id: string }) {
  const tab = useKpiHubEditorTab();
  const row = useMemo(() => findDictionaryById(id), [id]);
  if (!row) return <p className="error">Không tìm thấy KPI</p>;
  if (tab === 'formula') return <KpiHubFormulaTab />;
  if (tab === 'source') return <KpiHubMappingTab />;
  if (tab === 'target') return <TargetTab row={row} />;
  if (tab === 'governance') return <GovernanceTab row={row} />;
  return <OverviewTab row={row} />;
}

export default function KpiHubDictionaryEditPage() {
  const params = useParams();
  const id = String(params?.id ?? '');

  return (
    <KpiHubPageGate section="crm_kpi_dictionary">
      <KpiHubShell
        title="Chỉnh sửa KPI"
        subtitle=""
        breadcrumb={[
          { label: 'KPI Dictionary', href: '/crm/kpi-hub/dictionary' },
          { label: findDictionaryById(id)?.name ?? id },
          { label: 'Chỉnh sửa' },
        ]}
      >
        {findDictionaryById(id) ? (
          <KpiHubEditorChrome
            row={findDictionaryById(id)!}
            breadcrumb={[
              { label: 'KPI Dictionary', href: '/crm/kpi-hub/dictionary' },
              { label: findDictionaryById(id)!.name },
              { label: 'Chỉnh sửa' },
            ]}
          >
            <EditorBody id={id} />
          </KpiHubEditorChrome>
        ) : (
          <p className="error">Không tìm thấy KPI</p>
        )}
      </KpiHubShell>
    </KpiHubPageGate>
  );
}

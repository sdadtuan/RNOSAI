'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { KpiHubDictDrawer } from '@/components/kpi-hub/dictionary/KpiHubDictDrawer';
import { KpiHubDictFilterBar } from '@/components/kpi-hub/dictionary/KpiHubDictFilterBar';
import { KpiHubDictSummaryCards } from '@/components/kpi-hub/dictionary/KpiHubDictSummaryCards';
import { KpiHubDictTable } from '@/components/kpi-hub/dictionary/KpiHubDictTable';
import { KPI_HUB_DICTIONARY, type KpiHubDictionaryRow } from '@/lib/kpi-hub-fixtures';

export default function KpiHubDictionaryPage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('');
  const [owner, setOwner] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<KpiHubDictionaryRow | null>(null);

  const rows = useMemo(() => {
    return KPI_HUB_DICTIONARY.filter((row) => {
      if (group && row.group !== group) return false;
      if (status && row.status !== status) return false;
      if (owner && row.dataOwner !== owner) return false;
      if (q) {
        const hay = `${row.code} ${row.name} ${row.source}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [group, owner, q, status]);

  return (
    <KpiHubPageGate section="crm_kpi_dictionary">
      <KpiHubShell
        title="KPI Dictionary"
        subtitle="Quản trị từ điển KPI Marketing & Sales"
        breadcrumb={[{ label: 'Quản trị dữ liệu' }, { label: 'KPI Dictionary' }]}
      >
        <div className={`kpi-hub-page-with-drawer${selected ? ' has-drawer' : ''}`}>
          <div className="kpi-hub-page-with-drawer__main">
            <KpiHubDictSummaryCards />
            <KpiHubDictFilterBar
              q={q}
              group={group}
              owner={owner}
              status={status}
              onChange={(patch) => {
                if ('q' in patch) setQ(patch.q ?? '');
                if ('group' in patch) setGroup(patch.group ?? '');
                if ('owner' in patch) setOwner(patch.owner ?? '');
                if ('status' in patch) setStatus(patch.status ?? '');
              }}
              onCreate={() => router.push('/crm/kpi-hub/dictionary/new')}
            />
            <KpiHubDictTable rows={rows} selectedId={selected?.id} onSelect={setSelected} />
          </div>
          <KpiHubDictDrawer row={selected} onClose={() => setSelected(null)} />
        </div>
      </KpiHubShell>
    </KpiHubPageGate>
  );
}

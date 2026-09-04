'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { KpiHubDictDrawer } from '@/components/kpi-hub/dictionary/KpiHubDictDrawer';
import { KpiHubDictFilterBar } from '@/components/kpi-hub/dictionary/KpiHubDictFilterBar';
import { KpiHubDictSummaryCards } from '@/components/kpi-hub/dictionary/KpiHubDictSummaryCards';
import { KpiHubDictTable } from '@/components/kpi-hub/dictionary/KpiHubDictTable';
import { useKpiHubDictionary } from '@/hooks/useKpiHubDictionary';
import { getAccessToken } from '@/lib/auth';
import type { KpiHubDictionaryRow } from '@/lib/kpi-hub-fixtures';

export default function KpiHubDictionaryPage() {
  const router = useRouter();
  const token = getAccessToken() ?? '';
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('');
  const [owner, setOwner] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<KpiHubDictionaryRow | null>(null);

  const { rows: apiRows, summary, loading, error } = useKpiHubDictionary(token, {
    q,
    group,
    owner,
    status,
  });

  const rows = useMemo(() => {
    return apiRows.filter((row) => {
      if (group && row.group !== group) return false;
      if (status && row.status !== status) return false;
      if (owner && row.dataOwner !== owner) return false;
      if (q) {
        const hay = `${row.code} ${row.name} ${row.source}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [apiRows, group, owner, q, status]);

  return (
    <KpiHubPageGate section="crm_kpi_dictionary">
      <KpiHubShell
        title="KPI Dictionary"
        subtitle="Quản trị từ điển KPI Marketing & Sales"
        breadcrumb={[{ label: 'Quản trị dữ liệu' }, { label: 'KPI Dictionary' }]}
      >
        {error ? <p className="error">{error}</p> : null}
        <div className={`kpi-hub-page-with-drawer${selected ? ' has-drawer' : ''}`}>
          <div className="kpi-hub-page-with-drawer__main">
            <KpiHubDictSummaryCards summary={summary} loading={loading} />
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
            {loading ? (
              <div className="kpi-hub-table-wrap kpi-hub-skeleton-table">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="kpi-hub-skeleton kpi-hub-skeleton--line" />
                ))}
              </div>
            ) : (
              <KpiHubDictTable rows={rows} selectedId={selected?.id} onSelect={setSelected} />
            )}
          </div>
          <KpiHubDictDrawer row={selected} onClose={() => setSelected(null)} />
        </div>
      </KpiHubShell>
    </KpiHubPageGate>
  );
}

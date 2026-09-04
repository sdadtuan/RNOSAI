'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { KpiHubDictDrawer } from '@/components/kpi-hub/dictionary/KpiHubDictDrawer';
import { KpiHubDictFilterBar } from '@/components/kpi-hub/dictionary/KpiHubDictFilterBar';
import { KpiHubDictSummaryCards } from '@/components/kpi-hub/dictionary/KpiHubDictSummaryCards';
import { KpiHubDictTable } from '@/components/kpi-hub/dictionary/KpiHubDictTable';
import { useKpiHubDictionary } from '@/hooks/useKpiHubDictionary';
import { useKpiHubDictionaryDetail } from '@/hooks/useKpiHubDictionaryDetail';
import { uniqueOwners } from '@/lib/kpi-hub-dictionary-utils';
import { getAccessToken } from '@/lib/auth';
import type { KpiHubDictionaryRow } from '@/lib/kpi-hub-fixtures';

const PAGE_SIZE = 5;

export default function KpiHubDictionaryPage() {
  const router = useRouter();
  const token = getAccessToken() ?? '';
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('');
  const [owner, setOwner] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<KpiHubDictionaryRow | null>(null);

  const { rows: apiRows, summary, loading, error } = useKpiHubDictionary(token, {
    q,
    group,
    owner,
    status,
  });

  const { row: detailRow, loading: detailLoading } = useKpiHubDictionaryDetail(token, selected?.id ?? null);

  const owners = useMemo(() => uniqueOwners(apiRows), [apiRows]);

  const filteredRows = useMemo(() => {
    return apiRows
      .filter((row) => {
        if (group && row.group !== group) return false;
        if (status && row.status !== status) return false;
        if (owner && row.dataOwner !== owner && row.dataOwnerRole !== owner) return false;
        if (q) {
          const hay = `${row.code} ${row.name} ${row.source} ${(row.sources ?? []).join(' ')}`.toLowerCase();
          if (!hay.includes(q.toLowerCase())) return false;
        }
        return true;
      })
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [apiRows, group, owner, q, status]);

  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  const drawerRow = detailRow ?? selected;

  return (
    <KpiHubPageGate section="crm_kpi_dictionary">
      <KpiHubShell
        title="KPI Dictionary"
        subtitle="Chuẩn hóa định nghĩa chỉ số cho Marketing, Sales và Finance."
        breadcrumb={[{ label: 'Quản trị dữ liệu' }, { label: 'KPI Dictionary' }]}
        actions={
          <button
            type="button"
            className="kpi-hub-btn kpi-hub-btn--primary"
            onClick={() => router.push('/crm/kpi-hub/dictionary/new')}
          >
            + Tạo KPI
          </button>
        }
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
              owners={owners}
              onChange={(patch) => {
                if ('q' in patch) setQ(patch.q ?? '');
                if ('group' in patch) setGroup(patch.group ?? '');
                if ('owner' in patch) setOwner(patch.owner ?? '');
                if ('status' in patch) setStatus(patch.status ?? '');
                setPage(1);
              }}
              onReset={() => {
                setQ('');
                setGroup('');
                setOwner('');
                setStatus('');
                setPage(1);
              }}
            />
            {loading ? (
              <div className="kpi-hub-table-wrap kpi-hub-skeleton-table">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="kpi-hub-skeleton kpi-hub-skeleton--line" />
                ))}
              </div>
            ) : (
              <KpiHubDictTable
                rows={pagedRows}
                selectedId={selected?.id}
                page={page}
                pageSize={PAGE_SIZE}
                total={total}
                onPageChange={setPage}
                onSelect={setSelected}
              />
            )}
          </div>
          <KpiHubDictDrawer row={drawerRow} loading={detailLoading && !!selected} onClose={() => setSelected(null)} />
        </div>
      </KpiHubShell>
    </KpiHubPageGate>
  );
}

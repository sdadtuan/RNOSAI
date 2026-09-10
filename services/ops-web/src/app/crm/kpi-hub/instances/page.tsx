'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { ServiceKpiInstanceDetailDrawer } from '@/components/kpi-hub/service-kpi/ServiceKpiInstanceDetailDrawer';
import { ServiceKpiInstanceDrawer } from '@/components/kpi-hub/service-kpi/ServiceKpiInstanceDrawer';
import { ServiceKpiInstanceTable } from '@/components/kpi-hub/service-kpi/ServiceKpiInstanceTable';
import type { ServiceKpiInstanceItem } from '@/lib/service-kpi-types';
import { useKpiHubDictionary } from '@/hooks/useKpiHubDictionary';
import { useServiceKpiInstances } from '@/hooks/useServiceKpiInstances';
import { getAccessToken, getStoredUser, hasCap } from '@/lib/auth';
import { dictionaryLabelMap } from '@/lib/service-kpi-dictionary-labels';
import { SKPI_SUBTITLES, SNAPSHOT_INSTANCE_BANNER } from '@/lib/service-kpi-copy';
import { SkpiFilterChips } from '@/components/kpi-hub/service-kpi/SkpiFilterChips';
import { SkpiSuccessBanner } from '@/components/kpi-hub/service-kpi/SkpiSuccessBanner';

const FILTER_CHIPS = [
  { value: '', label: 'Tất cả' },
  { value: 'quote_line_item', label: 'Quote' },
  { value: 'project', label: 'Project' },
  { value: 'AT_RISK', label: 'At Risk' },
];

export default function KpiHubInstancesPage() {
  const token = getAccessToken() ?? '';
  const canManage = hasCap(getStoredUser(), 'crm_kpi_dictionary', 'manage');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailInstance, setDetailInstance] = useState<ServiceKpiInstanceItem | null>(null);
  const params = useSearchParams();
  const instanceParam = params.get('instance') ?? '';
  const [chipFilter, setChipFilter] = useState(params.get('status') ?? '');
  const sourceType = chipFilter === 'quote_line_item' || chipFilter === 'project' ? chipFilter : '';
  const statusFilter = chipFilter === 'AT_RISK' ? 'AT_RISK' : '';

  const { rows: dictionaryRows } = useKpiHubDictionary(token, { status: 'ACTIVE' });
  const labels = useMemo(() => dictionaryLabelMap(dictionaryRows), [dictionaryRows]);

  const { items, loading, error, total, refresh } = useServiceKpiInstances(token, {
    status: statusFilter || undefined,
    source_type: sourceType || undefined,
  });

  const sortedItems = useMemo(() => {
    if (!instanceParam) return items;
    return [...items].sort((a, b) => (a.id === instanceParam ? -1 : b.id === instanceParam ? 1 : 0));
  }, [items, instanceParam]);

  useEffect(() => {
    if (!instanceParam || !items.length) return;
    const hit = items.find((i) => i.id === instanceParam);
    if (hit) setDetailInstance(hit);
  }, [instanceParam, items]);

  return (
    <KpiHubPageGate section="crm_kpi_hub">
      <KpiHubShell
        title="KPI Instances"
        subtitle={SKPI_SUBTITLES.instances}
        breadcrumb={[{ label: 'KPI Hub' }, { label: 'Service KPI' }, { label: 'KPI Instances' }]}
        actions={
          <>
            <Link href="/crm/kpi-hub/service-templates" className="kpi-hub-btn kpi-hub-btn--ghost">
              Service KPI Template
            </Link>
            {canManage ? (
              <button
                type="button"
                className="kpi-hub-btn kpi-hub-btn--primary"
                onClick={() => setDrawerOpen(true)}
              >
                + Tạo KPI Instance
              </button>
            ) : null}
          </>
        }
        searchPlaceholder="Tìm instance, quote, client…"
      >
        <SkpiFilterChips options={FILTER_CHIPS} value={chipFilter} onChange={setChipFilter} />
        <p className="kpi-hub-muted" style={{ margin: '8px 0 12px' }}>
          {total} instances
        </p>
        {loading ? <p className="kpi-hub-muted">Đang tải…</p> : null}
        {error ? <p className="kpi-hub-form-error">{error}</p> : null}
        <ServiceKpiInstanceTable
          rows={sortedItems}
          dictionaryLabels={labels}
          onSelect={(row) => setDetailInstance(row)}
        />
        <SkpiSuccessBanner title="Snapshot">{SNAPSHOT_INSTANCE_BANNER}</SkpiSuccessBanner>
      </KpiHubShell>
      <ServiceKpiInstanceDrawer
        open={drawerOpen}
        token={token}
        onClose={() => setDrawerOpen(false)}
        onCreated={() => refresh()}
      />
      <ServiceKpiInstanceDetailDrawer
        open={Boolean(detailInstance)}
        token={token}
        instance={detailInstance}
        dictionaryLabel={detailInstance ? labels[detailInstance.dictionary_id] : undefined}
        onClose={() => setDetailInstance(null)}
        onUpdated={() => refresh()}
      />
    </KpiHubPageGate>
  );
}

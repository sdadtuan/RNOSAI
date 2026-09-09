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

const SOURCE_FILTERS = [
  { value: '', label: 'Tất cả' },
  { value: 'quote_line_item', label: 'Quote' },
  { value: 'project', label: 'Project' },
];

const STATUS_FILTERS = [
  { value: '', label: 'Mọi status' },
  { value: 'TRACKING', label: 'Tracking' },
  { value: 'AT_RISK', label: 'At Risk' },
  { value: 'DRAFT', label: 'Draft' },
];

export default function KpiHubInstancesPage() {
  const token = getAccessToken() ?? '';
  const canManage = hasCap(getStoredUser(), 'crm_kpi_dictionary', 'manage');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailInstance, setDetailInstance] = useState<ServiceKpiInstanceItem | null>(null);
  const params = useSearchParams();
  const instanceParam = params.get('instance') ?? '';
  const [sourceType, setSourceType] = useState('');
  const [statusFilter, setStatusFilter] = useState(params.get('status') ?? '');

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
        subtitle="KPI kế thừa/cấu hình theo Quote, Proposal, Project, Work Order hoặc Campaign"
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
        <div className="kpi-hub-skpi-summary">
          <span>{total} instances</span>
        </div>
        <div className="kpi-hub-filters" style={{ marginTop: 12 }}>
          {SOURCE_FILTERS.map((f) => (
            <button
              key={f.value || 'all-src'}
              type="button"
              className={`kpi-hub-filter${sourceType === f.value ? ' is-active' : ''}`}
              onClick={() => setSourceType(f.value)}
            >
              {f.label}
            </button>
          ))}
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value || 'all-st'}
              type="button"
              className={`kpi-hub-filter${statusFilter === f.value ? ' is-active' : ''}`}
              onClick={() => setStatusFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
        {loading ? <p className="kpi-hub-muted">Đang tải…</p> : null}
        {error ? <p className="kpi-hub-form-error">{error}</p> : null}
        <ServiceKpiInstanceTable
          rows={sortedItems}
          dictionaryLabels={labels}
          onSelect={(row) => setDetailInstance(row)}
        />
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

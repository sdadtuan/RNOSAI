'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { ServiceKpiTemplateBuilder } from '@/components/kpi-hub/service-kpi/ServiceKpiTemplateBuilder';
import { ServiceKpiTemplateDrawer } from '@/components/kpi-hub/service-kpi/ServiceKpiTemplateDrawer';
import { ServiceKpiTemplateTable } from '@/components/kpi-hub/service-kpi/ServiceKpiTemplateTable';
import { useServiceKpiTemplates } from '@/hooks/useServiceKpiTemplates';
import { getAccessToken } from '@/lib/auth';
import { fetchServiceKpiTemplate, submitServiceKpiTemplateVersion } from '@/lib/service-kpi-api';
import type { ServiceKpiTemplateListItem } from '@/lib/service-kpi-types';

export default function KpiHubServiceTemplatesPage() {
  const token = getAccessToken() ?? '';
  const [statusFilter, setStatusFilter] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<(ServiceKpiTemplateListItem & { current_version?: { id: string; rules: unknown[] } | null }) | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { items, summary, loading, error, total, refresh } = useServiceKpiTemplates(token, {
    status: statusFilter || undefined,
  });

  const handleConfigure = useCallback(
    async (row: ServiceKpiTemplateListItem) => {
      if (!token) {
        setSelected(row);
        return;
      }
      try {
        const detail = (await fetchServiceKpiTemplate(token, row.id)) as ServiceKpiTemplateListItem & {
          current_version?: { id: string; rules: unknown[] } | null;
        };
        setSelected(detail);
      } catch {
        setSelected(row);
      }
    },
    [token],
  );

  async function handleSubmitReview(versionId: string) {
    if (!token) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitServiceKpiTemplateVersion(token, versionId);
      refresh();
      if (selected) await handleConfigure(selected);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Submit review thất bại');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KpiHubPageGate section="crm_kpi_hub">
      <KpiHubShell
        title="Service KPI Template"
        subtitle="Cấu hình bộ KPI chuẩn cho Service Catalog (Portfolio 21 DV), package và vertical"
        breadcrumb={[{ label: 'KPI Hub' }, { label: 'Service KPI' }, { label: 'Service KPI Template' }]}
        actions={
          <>
            <Link href="/crm/kpi-hub/dictionary" className="kpi-hub-btn kpi-hub-btn--ghost">
              KPI Dictionary
            </Link>
            <Link href="/admin/services/portfolio" className="kpi-hub-btn kpi-hub-btn--ghost">
              Portfolio 21 DV
            </Link>
            <button type="button" className="kpi-hub-btn kpi-hub-btn--primary" onClick={() => setDrawerOpen(true)}>
              + Tạo Template
            </button>
          </>
        }
        searchPlaceholder="Tìm template, DV, service…"
      >
        <div className="kpi-hub-skpi-summary">
          <span>{summary.active} Active</span>
          <span>{summary.in_review} In Review</span>
          <span>{total} tổng</span>
        </div>
        <div className="kpi-hub-filters" style={{ marginTop: 12 }}>
          {['', 'ACTIVE', 'IN_REVIEW', 'DRAFT'].map((s) => (
            <button
              key={s || 'all'}
              type="button"
              className={`kpi-hub-filter${statusFilter === s ? ' is-active' : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {s === '' ? 'Tất cả' : s === 'IN_REVIEW' ? 'In Review' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        {loading ? <p className="kpi-hub-muted">Đang tải…</p> : null}
        {error ? <p className="kpi-hub-form-error">{error}</p> : null}
        <ServiceKpiTemplateTable rows={items} onConfigure={handleConfigure} />
        {selected ? (
          <div style={{ marginTop: 24 }}>
            <h2 className="kpi-hub-section-title">Cấu hình — {selected.name}</h2>
            {submitError ? <p className="kpi-hub-form-error">{submitError}</p> : null}
            <ServiceKpiTemplateBuilder
              template={selected}
              onSubmitReview={selected.current_version?.id ? handleSubmitReview : undefined}
              submitting={submitting}
            />
          </div>
        ) : null}
      </KpiHubShell>
      <ServiceKpiTemplateDrawer
        open={drawerOpen}
        token={token}
        onClose={() => setDrawerOpen(false)}
        onCreated={() => {
          refresh();
        }}
      />
    </KpiHubPageGate>
  );
}

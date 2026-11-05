'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { ServiceKpiSummaryTiles } from '@/components/kpi-hub/service-kpi/ServiceKpiSummaryTiles';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { ServiceKpiTemplateDrawer } from '@/components/kpi-hub/service-kpi/ServiceKpiTemplateDrawer';
import { ServiceKpiTemplateTable } from '@/components/kpi-hub/service-kpi/ServiceKpiTemplateTable';
import { useKpiHubDictionary } from '@/hooks/useKpiHubDictionary';
import { useServiceKpiTemplates } from '@/hooks/useServiceKpiTemplates';
import { getAccessToken, getStoredUser, hasCap } from '@/lib/auth';
import { fetchServiceKpiTemplate, submitServiceKpiTemplateVersion } from '@/lib/service-kpi-api';
import { SkpiFilterChips } from '@/components/kpi-hub/service-kpi/SkpiFilterChips';
import { SkpiNotice } from '@/components/kpi-hub/service-kpi/SkpiNotice';
import { SkpiSpecLink } from '@/components/kpi-hub/service-kpi/SkpiSpecLink';
import { SkpiTemplateDetailModal } from '@/components/kpi-hub/service-kpi/SkpiTemplateDetailModal';
import { PORTFOLIO_TEMPLATE_NOTICE, SKPI_SUBTITLES } from '@/lib/service-kpi-copy';
import type { ServiceKpiTemplateListItem } from '@/lib/service-kpi-types';

const TEMPLATE_FILTERS = [
  { value: '', label: 'Tất cả' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'PERFORMANCE', label: 'Performance ▾' },
  { value: 'CLIENT', label: 'Client-facing ▾' },
];

export default function KpiHubServiceTemplatesPage() {
  const token = getAccessToken() ?? '';
  const user = getStoredUser();
  const canManageDictionary = hasCap(user, 'crm_kpi_dictionary', 'manage');
  const [statusFilter, setStatusFilter] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<ServiceKpiTemplateListItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { rows: dictionaryRows } = useKpiHubDictionary(token, { status: 'ACTIVE' });

  const { items, loading, error, refresh } = useServiceKpiTemplates(token, {
    status: statusFilter || undefined,
  });
  const { items: allTemplates, summary: globalSummary } = useServiceKpiTemplates(token);

  const summaryTiles = useMemo(() => {
    const dvCodes = new Set(allTemplates.map((t) => t.dv_code));
    const clientVisible = allTemplates.reduce((s, t) => s + (t.client_visible_count ?? 0), 0);
    return [
      { label: 'TEMPLATE ACTIVE', value: globalSummary.active, hint: '13 nhóm dịch vụ', tone: 'ok' as const },
      {
        label: 'IN REVIEW',
        value: globalSummary.in_review,
        hint: 'Chờ Data/BI',
        tone: globalSummary.in_review ? ('warn' as const) : ('default' as const),
      },
      { label: 'DV CÓ TEMPLATE', value: `${dvCodes.size}/21`, hint: 'DV01–DV21 Portfolio', tone: 'ok' as const },
      {
        label: 'CLIENT-VISIBLE KPI',
        value: clientVisible,
        hint: allTemplates.length ? `Trung bình ${(clientVisible / Math.max(allTemplates.length, 1)).toFixed(1)}/template` : '—',
      },
    ];
  }, [allTemplates, globalSummary]);

  const handleConfigure = useCallback(
    async (row: ServiceKpiTemplateListItem) => {
      if (!token) {
        setSelected(row);
        setModalOpen(true);
        return;
      }
      try {
        const detail = (await fetchServiceKpiTemplate(token, row.id)) as ServiceKpiTemplateListItem;
        setSelected(detail);
        setModalOpen(true);
      } catch {
        setSelected(row);
        setModalOpen(true);
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
        subtitle={SKPI_SUBTITLES.templates}
        breadcrumb={[{ label: 'KPI Hub' }, { label: 'Service KPI' }, { label: 'Service KPI Template' }]}
        actions={
          <>
            <Link href="/crm/kpi-hub/dictionary" className="kpi-hub-btn kpi-hub-btn--ghost">
              KPI Dictionary
            </Link>
            {canManageDictionary ? (
              <Link href="/crm/kpi-hub/dictionary/new" className="kpi-hub-btn kpi-hub-btn--ghost">
                + Tạo KPI Definition
              </Link>
            ) : null}
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
        <ServiceKpiSummaryTiles tiles={summaryTiles} />
        <SkpiFilterChips
          options={TEMPLATE_FILTERS}
          value={statusFilter === 'ACTIVE' || statusFilter === 'IN_REVIEW' ? statusFilter : ''}
          onChange={(v) => {
            if (v === 'PERFORMANCE' || v === 'CLIENT') return;
            setStatusFilter(v);
          }}
          className="kpi-hub-skpi-filters--spaced"
        />
        {loading ? <p className="kpi-hub-muted">Đang tải…</p> : null}
        {error ? <p className="kpi-hub-form-error">{error}</p> : null}
        <ServiceKpiTemplateTable rows={items} onConfigure={handleConfigure} />
        {submitError ? <p className="kpi-hub-form-error">{submitError}</p> : null}
        <SkpiNotice title="Liên kết Portfolio 21 DV:">{PORTFOLIO_TEMPLATE_NOTICE}</SkpiNotice>
        <SkpiSpecLink />
      </KpiHubShell>
      <SkpiTemplateDetailModal
        open={modalOpen}
        template={selected}
        dictionary={dictionaryRows}
        onClose={() => setModalOpen(false)}
        onSubmitReview={
          selected?.current_version?.id && canManageDictionary
            ? () => void handleSubmitReview(selected.current_version!.id)
            : undefined
        }
        submitting={submitting}
      />
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

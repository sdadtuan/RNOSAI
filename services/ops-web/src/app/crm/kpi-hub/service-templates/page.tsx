'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { ServiceKpiTemplateBuilder } from '@/components/kpi-hub/service-kpi/ServiceKpiTemplateBuilder';
import { ServiceKpiTemplateDrawer } from '@/components/kpi-hub/service-kpi/ServiceKpiTemplateDrawer';
import { ServiceKpiTemplateTable } from '@/components/kpi-hub/service-kpi/ServiceKpiTemplateTable';
import { useKpiHubDictionary } from '@/hooks/useKpiHubDictionary';
import { useServiceKpiTemplates } from '@/hooks/useServiceKpiTemplates';
import { getAccessToken, getStoredUser, hasCap } from '@/lib/auth';
import {
  activateServiceKpiTemplateVersion,
  fetchServiceKpiTemplate,
  submitServiceKpiTemplateVersion,
  updateServiceKpiTemplateRules,
} from '@/lib/service-kpi-api';
import type { ServiceKpiTemplateListItem, ServiceKpiTemplateRule } from '@/lib/service-kpi-types';

export default function KpiHubServiceTemplatesPage() {
  const token = getAccessToken() ?? '';
  const user = getStoredUser();
  const canManageDictionary = hasCap(user, 'crm_kpi_dictionary', 'manage');
  const canPublish = hasCap(user, 'crm_kpi_dictionary', 'publish');
  const [statusFilter, setStatusFilter] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<ServiceKpiTemplateListItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { rows: dictionaryRows } = useKpiHubDictionary(token, { status: 'ACTIVE' });

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
        const detail = (await fetchServiceKpiTemplate(token, row.id)) as ServiceKpiTemplateListItem;
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

  async function handleActivate(versionId: string) {
    if (!token) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await activateServiceKpiTemplateVersion(token, versionId);
      refresh();
      if (selected) await handleConfigure(selected);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Activate thất bại');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveRules(rules: ServiceKpiTemplateRule[]) {
    if (!token || !selected?.current_version?.id) return;
    setSavingRules(true);
    setSubmitError(null);
    try {
      await updateServiceKpiTemplateRules(
        token,
        selected.current_version.id,
        rules.map((r) => ({
          dictionary_id: r.dictionary_id,
          classification: r.classification,
          is_required: r.is_required,
          client_visible: r.client_visible,
          target_min: r.target_min,
          target_max: r.target_max,
          assumption_template: r.assumption_template,
          disclaimer_template: r.disclaimer_template,
          owner_role: r.owner_role,
          cadence: r.cadence,
        })),
      );
      if (selected) await handleConfigure(selected);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Lưu rules thất bại');
      throw err;
    } finally {
      setSavingRules(false);
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
              dictionary={dictionaryRows}
              editable={canManageDictionary}
              onSaveRules={canManageDictionary ? handleSaveRules : undefined}
              onSubmitReview={selected.current_version?.id ? handleSubmitReview : undefined}
              onActivate={canPublish ? handleActivate : undefined}
              submitting={submitting}
              saving={savingRules}
              canPublish={canPublish}
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

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { DeliveryProjectRow } from '@/lib/delivery-projects-api';
import {
  createDeliveryChangeRequest,
  createDeliveryRisk,
  fetchDeliveryChangeRequests,
  fetchDeliveryRisks,
  type DeliveryChangeRequestRow,
  type DeliveryRiskRow,
} from '@/lib/delivery-projects-api';
import { hasCapability, labelDeliveryCapability, normalizeCapabilities } from '@/lib/delivery-projects.util';
import { getAccessToken } from '@/lib/auth';
import { Form, FormField, FormFooter, FormGrid, FormSection } from '@/components/form';
import { FormInput } from '@/components/form/FormControls';
import { labelB2bProjectStatus } from '@/lib/b2b-project-util';
import { ChangeRequestDrawer } from './ChangeRequestDrawer';
import { DeliveryEmptyPanel } from './DeliveryEmptyPanel';
import { DeliveryRiskPanel } from './DeliveryRiskPanel';

type DetailTab =
  | 'overview'
  | 'ingest'
  | 'scope'
  | 'milestone'
  | 'budget'
  | 'kpi'
  | 'risk';

type DeliveryDetailTabsProps = {
  project: DeliveryProjectRow;
  ingestPanel?: React.ReactNode;
  scopePanel?: React.ReactNode;
  milestonePanel?: React.ReactNode;
};

export function DeliveryDetailTabs({ project, ingestPanel, scopePanel, milestonePanel }: DeliveryDetailTabsProps) {
  const caps = normalizeCapabilities(project.capabilities);
  const hasDelivery = hasCapability(caps, 'delivery');
  const hasLead = hasCapability(caps, 'lead_ingest');
  const isLegacy = project.ingest_code === 'PTT-LEGACY' || project.code === 'PTT-LEGACY';

  const tabs: Array<{ id: DetailTab; label: string; hidden?: boolean }> = [
    { id: 'overview', label: 'Tổng quan' },
    { id: 'ingest', label: 'Nhận lead', hidden: !hasLead },
    { id: 'scope', label: 'Phạm vi', hidden: isLegacy || !hasDelivery },
    { id: 'milestone', label: 'Milestone', hidden: isLegacy || !hasDelivery },
    { id: 'budget', label: 'Ngân sách' },
    { id: 'kpi', label: 'KPI' },
    { id: 'risk', label: 'Rủi ro' },
  ];

  const visibleTabs = tabs.filter((t) => !t.hidden);
  const [tab, setTab] = useState<DetailTab>(visibleTabs[0]?.id ?? 'overview');
  const [risks, setRisks] = useState<DeliveryRiskRow[]>([]);
  const [changeRequests, setChangeRequests] = useState<DeliveryChangeRequestRow[]>([]);
  const [crOpen, setCrOpen] = useState(false);
  const [riskTitle, setRiskTitle] = useState('');
  const [loadingOps, setLoadingOps] = useState(false);

  const loadOps = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoadingOps(true);
    try {
      const [r, cr] = await Promise.all([
        fetchDeliveryRisks(token, project.id),
        fetchDeliveryChangeRequests(token, project.id),
      ]);
      setRisks(r.items);
      setChangeRequests(cr.items);
    } finally {
      setLoadingOps(false);
    }
  }, [project.id]);

  useEffect(() => {
    if (tab === 'risk') void loadOps();
  }, [loadOps, tab]);

  async function addRisk() {
    const token = getAccessToken();
    if (!token || !riskTitle.trim()) return;
    await createDeliveryRisk(token, project.id, { severity: 'medium', title: riskTitle.trim() });
    setRiskTitle('');
    await loadOps();
  }

  async function onCreateCr(body: { kind: 'scope' | 'budget'; note?: string; submit?: boolean }) {
    const token = getAccessToken();
    if (!token) return;
    await createDeliveryChangeRequest(token, project.id, body);
    setCrOpen(false);
    await loadOps();
  }

  const code = project.code ?? project.ingest_code ?? '—';
  const dates =
    project.start_date || project.end_date
      ? `${project.start_date ?? '—'} → ${project.end_date ?? '—'}`
      : '—';

  return (
    <div className="delivery-detail">
      <div className="delivery-detail__head">
        <div className="delivery-cap-pills">
          {caps.map((cap) => (
            <span key={cap} className={`delivery-cap-pill delivery-cap-pill--${cap}`}>
              {labelDeliveryCapability(cap)}
            </span>
          ))}
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCrOpen(true)}>
          Yêu cầu thay đổi
        </button>
      </div>

      <div className="lead-detail-tabs" role="tablist">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'is-active' : ''}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="delivery-detail__body">
        {tab === 'overview' ? (
          <div className="page-card">
            <Form asDiv>
              <FormSection title="Thông tin dự án">
                <FormGrid cols={2}>
                  <FormField label="Mã">
                    <FormInput value={code} readOnly />
                  </FormField>
                  <FormField label="Trạng thái">
                    <FormInput value={labelB2bProjectStatus(project.status)} readOnly />
                  </FormField>
                  <FormField label="PM">
                    <FormInput value={project.pm_staff_id != null ? String(project.pm_staff_id) : '—'} readOnly />
                  </FormField>
                  <FormField label="AM">
                    <FormInput value={project.am_staff_id != null ? String(project.am_staff_id) : '—'} readOnly />
                  </FormField>
                  <FormField label="Thời gian">
                    <FormInput value={dates} readOnly />
                  </FormField>
                  <FormField label="Mô tả" className="form-field--full">
                    <FormInput value={project.description || '—'} readOnly />
                  </FormField>
                </FormGrid>
              </FormSection>
            </Form>
          </div>
        ) : null}

        {tab === 'ingest' ? (
          ingestPanel ?? (
            <div className="page-card">
              <DeliveryEmptyPanel title="Nhận lead" message="Dự án này không bật nhận lead." />
            </div>
          )
        ) : null}
        {tab === 'scope' ? (
          scopePanel ?? (
            <div className="page-card">
              <DeliveryEmptyPanel title="Phạm vi" message="Chưa cấu hình phạm vi." />
            </div>
          )
        ) : null}
        {tab === 'milestone' ? (
          milestonePanel ?? (
            <div className="page-card">
              <DeliveryEmptyPanel title="Milestone" message="Chưa có milestone." />
            </div>
          )
        ) : null}

        {tab === 'budget' ? (
          <div className="page-card">
            <DeliveryEmptyPanel title="Ngân sách" message="Chưa có hạng mục ngân sách cho dự án này." />
          </div>
        ) : null}
        {tab === 'kpi' ? (
          <div className="page-card">
            <DeliveryEmptyPanel title="KPI" message="Chưa gắn KPI cho dự án này." />
          </div>
        ) : null}

        {tab === 'risk' ? (
          <div className="page-card stack-gap">
            <Form asDiv>
              <FormSection title="Ghi nhận rủi ro">
                <FormGrid cols={2}>
                  <FormField label="Tiêu đề" className="form-field--full">
                    <FormInput
                      value={riskTitle}
                      placeholder="Mô tả ngắn rủi ro"
                      onChange={(e) => setRiskTitle(e.target.value)}
                    />
                  </FormField>
                </FormGrid>
                <FormFooter>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => void addRisk()}>
                    Thêm rủi ro
                  </button>
                  <Link href="/crm/delivery-projects/risks" className="btn btn-secondary btn-sm">
                    Sổ rủi ro
                  </Link>
                </FormFooter>
              </FormSection>
            </Form>
            <DeliveryRiskPanel items={risks} loading={loadingOps} showProject={false} />
          </div>
        ) : null}
      </div>

      <ChangeRequestDrawer
        open={crOpen}
        projectLabel={`${project.code ?? project.id} — ${project.name}`}
        items={changeRequests}
        onClose={() => setCrOpen(false)}
        onCreate={(body) => void onCreateCr(body)}
      />
    </div>
  );
}

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

  return (
    <div className="delivery-detail">
      <div className="delivery-detail__head">
        <div>
          <h2>{project.name}</h2>
          <p className="delivery-detail__meta">
            {project.code ?? project.ingest_code ?? '—'} · {project.status}
          </p>
          <div className="delivery-cap-pills">
            {caps.map((cap) => (
              <span key={cap} className={`delivery-cap-pill delivery-cap-pill--${cap}`}>
                {labelDeliveryCapability(cap)}
              </span>
            ))}
          </div>
        </div>
        <button type="button" className="delivery-btn delivery-btn--secondary" onClick={() => setCrOpen(true)}>
          + Change Request
        </button>
      </div>

      <div className="delivery-tab-row">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`delivery-tab${tab === t.id ? ' delivery-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="delivery-detail__body">
        {tab === 'overview' ? (
          <div className="delivery-overview-grid">
            <div className="delivery-panel">
              <h3>Thông tin</h3>
              <dl className="delivery-dl">
                <dt>PM</dt>
                <dd>{project.pm_staff_id ?? '—'}</dd>
                <dt>AM</dt>
                <dd>{project.am_staff_id ?? '—'}</dd>
                <dt>Ngày</dt>
                <dd>
                  {project.start_date ?? '—'} → {project.end_date ?? '—'}
                </dd>
                <dt>Mô tả</dt>
                <dd>{project.description || '—'}</dd>
              </dl>
            </div>
            <DeliveryEmptyPanel title="Ngân sách" message="Chưa có ngân sách — Wave C." />
          </div>
        ) : null}

        {tab === 'ingest' ? ingestPanel ?? <p className="delivery-empty-hint">Không có cấu hình ingest.</p> : null}
        {tab === 'scope' ? scopePanel ?? <DeliveryEmptyPanel title="Phạm vi" message="Chưa cấu hình phạm vi." /> : null}
        {tab === 'milestone' ? milestonePanel ?? <DeliveryEmptyPanel title="Milestone" message="Chưa có milestone." /> : null}

        {tab === 'budget' ? <DeliveryEmptyPanel title="Ngân sách" message="Sẽ mở ở Wave C." /> : null}
        {tab === 'kpi' ? <DeliveryEmptyPanel title="KPI" message="Sẽ mở ở Wave D." /> : null}

        {tab === 'risk' ? (
          <div className="delivery-risk-tab">
            <div className="delivery-risk-tab__actions">
              <input
                className="delivery-filter-input"
                placeholder="Tiêu đề rủi ro mới"
                value={riskTitle}
                onChange={(e) => setRiskTitle(e.target.value)}
              />
              <button type="button" className="delivery-btn delivery-btn--primary" onClick={() => void addRisk()}>
                + Thêm rủi ro
              </button>
              <Link href="/crm/delivery-projects/risks" className="delivery-link">
                Mở Risk Register
              </Link>
            </div>
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

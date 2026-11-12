'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { LeadFunnelSnapshot } from '@/lib/api';
import { presalesStageLabel } from '@/lib/crm/lead-consult-tab.util';
import { intakeServiceLabel } from '@/lib/crm/intake-service-resolve';

export function LeadPipelinePresalesPanel({
  funnel,
  canEdit,
  busy,
  selectedServiceSlug,
  serviceOptions,
  intakeHref,
  onServiceChange,
  onStartPresales,
  onOpenConsultTab,
  tasks,
  r5Form,
  showPlan = false,
  stage,
}: {
  funnel: LeadFunnelSnapshot;
  canEdit: boolean;
  busy: boolean;
  selectedServiceSlug: string;
  serviceOptions: Array<{ slug: string; name: string }>;
  intakeHref: string;
  onServiceChange: (slug: string) => void;
  onStartPresales: () => void;
  onOpenConsultTab?: () => void;
  tasks: ReactNode;
  r5Form: ReactNode;
  showPlan?: boolean;
  stage?: 'lead' | 'consult' | 'proposal';
}) {
  const current = funnel.presales?.presales.stage;
  const viewStage = stage ?? current ?? 'lead';
  const showEnsure = !funnel.presales && canEdit && viewStage === 'lead';
  const showLeadIntake =
    Boolean(funnel.presales) && (viewStage === 'lead' || !String(current ?? '').trim());
  const showConsultBlock = Boolean(funnel.presales) && (viewStage === 'consult' || viewStage === 'proposal');

  return (
    <div className="card-inner" id="funnel-presales">
      <h3 style={{ marginTop: 0 }}>Pre-sales</h3>
      {showEnsure ? (
        <div className="stack-gap" style={{ marginTop: '0.5rem' }}>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span className="muted">Dịch vụ marketing (HĐ)</span>
            <select
              value={selectedServiceSlug}
              disabled={busy}
              onChange={(e) => onServiceChange(e.target.value)}
              style={{ width: '100%', maxWidth: '28rem' }}
            >
              {serviceOptions.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {intakeServiceLabel(item.slug, item.name)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy || !selectedServiceSlug}
            onClick={onStartPresales}
          >
            Bắt đầu pre-sales
          </button>
        </div>
      ) : null}
      {funnel.presales ? (
        <>
          <p>
            Giai đoạn:{' '}
            <strong>{presalesStageLabel(funnel.presales.presales.stage)}</strong>
            {' · '}
            Dịch vụ:{' '}
            {intakeServiceLabel(
              funnel.presales.presales.service_slug,
              serviceOptions.find((item) => item.slug === funnel.presales?.presales.service_slug)?.name,
            )}
          </p>
          {showConsultBlock ? (
            <div className="banner banner-info stack-gap" style={{ marginTop: '0.5rem' }}>
              {onOpenConsultTab ? (
                <button type="button" className="btn btn-sm btn-primary" onClick={onOpenConsultTab}>
                  {viewStage === 'consult' ? 'Mở màn tư vấn' : 'Mở màn tư vấn →'}
                </button>
              ) : null}
              {showPlan ? r5Form : null}
            </div>
          ) : showLeadIntake ? (
            <p style={{ margin: '0.5rem 0' }}>
              <Link href={intakeHref} className="nav-link">
                Mở Lead Intake (BANT) →
              </Link>
            </p>
          ) : (
            tasks
          )}
        </>
      ) : null}
    </div>
  );
}

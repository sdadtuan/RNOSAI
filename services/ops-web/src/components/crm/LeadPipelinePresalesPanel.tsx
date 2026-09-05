'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { LeadFunnelSnapshot } from '@/lib/api';

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
                  {item.name} ({item.slug})
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
            Giai đoạn: <strong>{funnel.presales.presales.stage}</strong> · Dịch vụ:{' '}
            {funnel.presales.presales.service_slug || '—'}
          </p>
          {showConsultBlock ? (
            <div className="banner banner-info stack-gap" style={{ marginTop: '0.5rem' }}>
              <p style={{ margin: 0 }}>
                Workspace <strong>Tư vấn / Báo giá</strong> nằm trên tab <strong>Tư vấn</strong>. Chỉnh
                sửa R5 (gate G4) tại form bên dưới.
              </p>
              {onOpenConsultTab ? (
                <button type="button" className="btn btn-sm btn-primary" onClick={onOpenConsultTab}>
                  {viewStage === 'consult' ? 'Mở tab Tư vấn đầy đủ' : 'Mở tab Tư vấn →'}
                </button>
              ) : null}
              {r5Form}
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

'use client';

import { useEffect, useState } from 'react';
import { LeadB2OutcomeCard } from '@/components/crm/LeadB2OutcomeCard';
import { LeadFrSlaPanel } from '@/components/crm/LeadFrSlaPanel';
import type { B2OutcomePlan } from '@/lib/crm/lead-b2-outcome';
import type { LeadFunnelSnapshot } from '@/lib/api';

type B2WorkTab = 'fr' | 'outcome';

export function LeadPipelineB2Panel({
  funnel,
  canEdit,
  inReview,
  busy,
  highlightAfterCall,
  onSubmit,
  onError,
  token,
  leadId,
  canWriteFr = true,
  embedFrSla = false,
  statusChip,
}: {
  funnel: LeadFunnelSnapshot;
  canEdit: boolean;
  inReview: boolean;
  busy: boolean;
  highlightAfterCall: boolean;
  onSubmit: (plan: B2OutcomePlan) => Promise<void>;
  onError: (msg: string) => void;
  token?: string;
  leadId?: number;
  canWriteFr?: boolean;
  /** Gộp SLA phản hồi đầu vào bước B2 (pipeline) — tránh panel trùng phía trên. */
  embedFrSla?: boolean;
  statusChip?: string | null;
}) {
  const b2Stage = funnel.care_pipeline.stages[0];
  const negativeReportCount = funnel.care_pipeline.b2_negative_report_count ?? 0;
  const b2Done = Boolean(funnel.care_pipeline.all_complete || b2Stage?.done);
  const showOutcome = !b2Done && canEdit && !inReview;
  const showFr = embedFrSla && Boolean(token) && leadId != null;
  const [tab, setTab] = useState<B2WorkTab>('fr');

  useEffect(() => {
    if (highlightAfterCall) setTab('outcome');
  }, [highlightAfterCall]);

  const outcomeBody = (
    <>
      {showOutcome ? (
        <LeadB2OutcomeCard
          busy={busy}
          retryCount={negativeReportCount}
          lastNegativeLabel={funnel.care_pipeline.last_b2_care_status_label}
          highlightAfterCall={highlightAfterCall}
          onSubmit={onSubmit}
          onError={onError}
        />
      ) : null}
      {b2Done ? <p className="lead-b2-outcome__done">B2 đã xong — có thể sang Pre-sales Lead.</p> : null}
      {!b2Done && !showOutcome ? (
        <p className="muted">Không thể cập nhật kết quả B2 ở trạng thái hiện tại.</p>
      ) : null}
    </>
  );

  return (
    <div className="lead-b2-workspace" id="funnel-b2">
      <header className="lead-b2-workspace__head">
        <div className="lead-b2-workspace__titles">
          <h3>Liên hệ lần đầu (B2)</h3>
          <p className="lead-b2-workspace__sub">
            {showFr
              ? tab === 'fr'
                ? 'Đang mở phản hồi đầu. Sang tab Kết quả B2 khi đã nói chuyện với khách.'
                : 'Cửa sang Pre-sales. Không nghe máy và sai số vẫn ghi ở tab Phản hồi đầu.'
              : 'Xác nhận đã nói chuyện để hoàn thành B2 và mở Pre-sales.'}
          </p>
        </div>
        {statusChip ? <span className="lead-b2-workspace__chip">{statusChip}</span> : null}
      </header>

      {showFr ? (
        <>
          <div className="lead-b2-tabs" role="tablist" aria-label="Liên hệ lần đầu">
            <button
              type="button"
              role="tab"
              id="lead-b2-tab-fr"
              aria-controls="lead-b2-panel-fr"
              aria-selected={tab === 'fr'}
              onClick={() => setTab('fr')}
            >
              <span className="lead-b2-tabs__no">1</span>
              <span className="lead-b2-tabs__label">Phản hồi đầu</span>
              <span className="lead-b2-tabs__meta">Ghi cuộc gọi</span>
            </button>
            <button
              type="button"
              role="tab"
              id="lead-b2-tab-outcome"
              aria-controls="lead-b2-panel-outcome"
              aria-selected={tab === 'outcome'}
              onClick={() => setTab('outcome')}
            >
              <span className="lead-b2-tabs__no">2</span>
              <span className="lead-b2-tabs__label">Kết quả B2</span>
              <span className="lead-b2-tabs__meta">{b2Done ? 'Đã xong' : 'Sang Pre-sales'}</span>
            </button>
          </div>

          <div
            role="tabpanel"
            id="lead-b2-panel-fr"
            aria-labelledby="lead-b2-tab-fr"
            hidden={tab !== 'fr'}
            className="lead-b2-workspace__panel"
          >
            <h4 id="lead-b2-fr-heading" className="sr-only">
              Phản hồi đầu — ghi nhận cuộc gọi
            </h4>
            <LeadFrSlaPanel
              token={token!}
              leadId={leadId!}
              canWrite={canWriteFr && !inReview}
              variant="embedded"
            />
          </div>

          <div
            role="tabpanel"
            id="lead-b2-panel-outcome"
            aria-labelledby="lead-b2-tab-outcome"
            hidden={tab !== 'outcome'}
            className="lead-b2-workspace__panel"
          >
            <h4 id="lead-b2-outcome-heading" className="sr-only">
              Kết quả bước B2 — cửa sang Pre-sales
            </h4>
            <p className="lead-b2-workspace__panel-note">
              Chỉ xác nhận khi đã nói chuyện. Không nghe máy và sai số ghi ở tab Phản hồi đầu.
            </p>
            {outcomeBody}
          </div>
        </>
      ) : (
        <section className="lead-b2-workspace__phase" aria-labelledby="lead-b2-outcome-heading">
          <div className="lead-b2-workspace__phase-head">
            <span className="lead-b2-workspace__step">1</span>
            <div>
              <h4 id="lead-b2-outcome-heading">Kết quả bước B2 — cửa sang Pre-sales</h4>
              <p>Xác nhận đã nói chuyện để hoàn thành B2. Không nghe máy và sai số nằm ở phản hồi đầu.</p>
            </div>
          </div>
          {outcomeBody}
        </section>
      )}
    </div>
  );
}

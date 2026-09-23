'use client';

import { LeadB2OutcomeCard } from '@/components/crm/LeadB2OutcomeCard';
import { LeadFrSlaPanel } from '@/components/crm/LeadFrSlaPanel';
import type { B2OutcomePlan } from '@/lib/crm/lead-b2-outcome';
import type { LeadFunnelSnapshot } from '@/lib/api';

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

  return (
    <div className="lead-b2-workspace" id="funnel-b2">
      <header className="lead-b2-workspace__head">
        <div className="lead-b2-workspace__titles">
          <h3>Liên hệ lần đầu (B2)</h3>
          <p className="lead-b2-workspace__sub">
            Bước mở pipeline. Gồm hai việc khác nhau: dừng đồng hồ phản hồi đầu, rồi ghi nhận kết
            quả để sang Pre-sales.
          </p>
        </div>
        {statusChip ? <span className="lead-b2-workspace__chip">{statusChip}</span> : null}
      </header>

      <div className="lead-b2-workspace__link" role="note">
        <div>
          <strong>Phản hồi đầu (SLA)</strong>
          <span>Lần gọi điện thoại đầu sau khi lead được giao — đồng hồ riêng, bắt buộc đúng hạn.</span>
        </div>
        <div>
          <strong>Kết quả B2 (pipeline)</strong>
          <span>
            Chỉ xác nhận khi đã nói chuyện — lúc đó mới mở Pre-sales. Không nghe máy và sai số ghi ở phản hồi đầu.
          </span>
        </div>
      </div>

      {showFr ? (
        <section className="lead-b2-workspace__phase" aria-labelledby="lead-b2-fr-heading">
          <div className="lead-b2-workspace__phase-head">
            <span className="lead-b2-workspace__step">1</span>
            <div>
              <h4 id="lead-b2-fr-heading">Phản hồi đầu — ghi nhận cuộc gọi</h4>
              <p>Gọi khách và lưu kết quả để dừng / gia hạn đồng hồ SLA phản hồi đầu.</p>
            </div>
          </div>
          <LeadFrSlaPanel
            token={token!}
            leadId={leadId!}
            canWrite={canWriteFr && !inReview}
            variant="embedded"
          />
        </section>
      ) : null}

      <section
        className="lead-b2-workspace__phase"
        aria-labelledby="lead-b2-outcome-heading"
      >
        <div className="lead-b2-workspace__phase-head">
          <span className="lead-b2-workspace__step">{showFr ? '2' : '1'}</span>
          <div>
            <h4 id="lead-b2-outcome-heading">Kết quả bước B2 — cửa sang Pre-sales</h4>
            <p>
              Cổng pipeline: xác nhận đã nói chuyện để hoàn thành B2. Không nghe máy và sai số nằm ở bước phản hồi đầu.
            </p>
          </div>
        </div>

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
      </section>
    </div>
  );
}

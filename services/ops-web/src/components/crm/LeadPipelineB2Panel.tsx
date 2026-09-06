'use client';

import { LeadB2OutcomeCard } from '@/components/crm/LeadB2OutcomeCard';
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
}: {
  funnel: LeadFunnelSnapshot;
  canEdit: boolean;
  inReview: boolean;
  busy: boolean;
  highlightAfterCall: boolean;
  onSubmit: (plan: B2OutcomePlan) => Promise<void>;
  onError: (msg: string) => void;
}) {
  const b2Stage = funnel.care_pipeline.stages[0];
  const negativeReportCount = funnel.care_pipeline.b2_negative_report_count ?? 0;

  return (
    <div className="card-inner" id="funnel-b2">
      <h3 style={{ marginTop: 0 }}>B2 — {b2Stage?.label ?? 'Liên hệ lần đầu'}</h3>
      {!funnel.care_pipeline.all_complete && canEdit && !inReview ? (
        <LeadB2OutcomeCard
          busy={busy}
          retryCount={negativeReportCount}
          lastNegativeLabel={funnel.care_pipeline.last_b2_care_status_label}
          highlightAfterCall={highlightAfterCall}
          onSubmit={onSubmit}
          onError={onError}
        />
      ) : null}
      {funnel.care_pipeline.all_complete ? (
        <p className="lead-b2-outcome__done">B2 đã xong</p>
      ) : null}
    </div>
  );
}

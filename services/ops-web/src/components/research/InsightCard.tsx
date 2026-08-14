'use client';

import { EvidenceIdChip } from '@/components/research/EvidenceIdChip';
import {
  canSubmitInsightReview,
  INSIGHT_GATE_COPY,
  INSIGHT_STATUS_LABELS,
  type ResearchEvidence,
  type ResearchInsight,
} from '@/lib/market-research-api';

export function InsightCard({
  insight,
  evidence,
  canEdit,
  saving,
  onOpen,
  onSubmitReview,
}: {
  insight: ResearchInsight;
  evidence: ResearchEvidence[];
  canEdit: boolean;
  saving: boolean;
  onOpen: (insight: ResearchInsight) => void;
  onSubmitReview: (insight: ResearchInsight) => void;
}) {
  const verifiedCount = insight.evidence_ids.filter((id) =>
    evidence.some((ev) => ev.id === id && ev.qc_status === 'verified'),
  ).length;
  const canSubmit = canSubmitInsightReview(insight.status);
  const submitDisabled = saving || !canSubmit || verifiedCount < 1;

  return (
    <article className="card" style={{ padding: '0.85rem' }}>
      <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
        Insight #{insight.id} · {INSIGHT_STATUS_LABELS[insight.status]}
        {insight.ai_generated ? (
          <span
            style={{
              marginLeft: 6,
              padding: '0.05rem 0.4rem',
              borderRadius: 999,
              fontSize: '0.72rem',
              fontWeight: 700,
              background: 'rgba(99, 102, 241, 0.14)',
              color: '#3730a3',
            }}
          >
            AI
          </span>
        ) : null}
      </p>
      <p style={{ margin: '0.4rem 0', fontWeight: 600 }}>{insight.statement}</p>
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
        {insight.evidence_ids.length === 0 ? (
          <span className="muted">Chưa gắn evidence</span>
        ) : (
          insight.evidence_ids.map((id) => {
            const ev = evidence.find((row) => row.id === id);
            return <EvidenceIdChip key={id} id={id} locator={ev?.locator} />;
          })
        )}
      </div>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-sm btn-secondary" disabled={saving} onClick={() => onOpen(insight)}>
          Mở
        </button>
        {canEdit && canSubmit ? (
          <button
            type="button"
            className="btn btn-sm"
            disabled={submitDisabled}
            title={verifiedCount < 1 ? INSIGHT_GATE_COPY.missing_verified_evidence : undefined}
            onClick={() => onSubmitReview(insight)}
          >
            Gửi Lead duyệt
          </button>
        ) : null}
      </div>
    </article>
  );
}

'use client';

import type { PresalesConsultSlaSummary } from '@/lib/api';

interface Props {
  summary: PresalesConsultSlaSummary;
}

export function PresalesConsultSlaSummaryCard({ summary }: Props) {
  return (
    <section className="presales-sla-summary">
      <h3>SLA Consult → Báo giá (48h)</h3>
      <div className="presales-sla-summary__grid">
        <div>
          <span>Đang Consult</span>
          <strong>{summary.active_consult}</strong>
        </div>
        <div>
          <span>OK</span>
          <strong className="is-ok">{summary.sla_ok}</strong>
        </div>
        <div>
          <span>Sắp hết hạn</span>
          <strong className="is-warn">{summary.sla_warning}</strong>
        </div>
        <div>
          <span>Quá hạn</span>
          <strong className="is-breach">{summary.sla_breach}</strong>
        </div>
        <div>
          <span>Chuyển BG ≤48h</span>
          <strong>
            {summary.consult_to_proposal_48h_pct}% ({summary.consult_to_proposal_48h_num}/
            {summary.consult_to_proposal_48h_denom})
          </strong>
        </div>
      </div>
    </section>
  );
}

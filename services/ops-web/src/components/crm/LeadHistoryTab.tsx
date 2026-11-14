'use client';

import { LeadCallHistoryPanel } from '@/components/crm/LeadCallHistoryPanel';
import { LeadExchangeHistoryPanel } from '@/components/crm/LeadExchangeHistoryPanel';
import type { LeadHistoryLine } from '@/lib/crm/lead-history';

export function LeadHistoryTab({
  token,
  leadId,
  exchangeLines,
  ownerLines = [],
  selectedActivityId,
  onSelectActivity,
}: {
  token: string;
  leadId: number;
  exchangeLines: LeadHistoryLine[];
  ownerLines?: LeadHistoryLine[];
  selectedActivityId: number | null;
  onSelectActivity: (id: number | null) => void;
}) {
  return (
    <div className="lead-history-tab" data-testid="lead-history-tab">
      <LeadCallHistoryPanel token={token} leadId={leadId} />
      <section className="lead-panel" data-testid="lead-owner-history">
        <div className="lead-panel__head">
          <h3 className="lead-panel__title">Lịch sử phụ trách</h3>
        </div>
        {ownerLines.length === 0 ? (
          <p className="lead-empty-state">Chưa có lần chuyển Sales.</p>
        ) : (
          <ul className="lead-activity-list">
            {ownerLines.map((line) => (
              <li key={line.key} className="lead-activity-item" data-testid="lead-owner-history-item">
                <div className="lead-activity-item__content">{line.what}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <LeadExchangeHistoryPanel
        lines={exchangeLines}
        selectedActivityId={selectedActivityId}
        onSelectActivity={onSelectActivity}
      />
    </div>
  );
}

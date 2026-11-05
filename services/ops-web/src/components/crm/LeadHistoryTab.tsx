'use client';

import { LeadCallHistoryPanel } from '@/components/crm/LeadCallHistoryPanel';
import { LeadExchangeHistoryPanel } from '@/components/crm/LeadExchangeHistoryPanel';
import type { LeadHistoryLine } from '@/lib/crm/lead-history';

export function LeadHistoryTab({
  token,
  leadId,
  exchangeLines,
  selectedActivityId,
  onSelectActivity,
}: {
  token: string;
  leadId: number;
  exchangeLines: LeadHistoryLine[];
  selectedActivityId: number | null;
  onSelectActivity: (id: number | null) => void;
}) {
  return (
    <div className="lead-history-tab" data-testid="lead-history-tab">
      <LeadExchangeHistoryPanel
        lines={exchangeLines}
        selectedActivityId={selectedActivityId}
        onSelectActivity={onSelectActivity}
      />
      <LeadCallHistoryPanel token={token} leadId={leadId} />
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { LeadCallHistoryPanel } from '@/components/crm/LeadCallHistoryPanel';
import { LeadExchangeHistoryPanel } from '@/components/crm/LeadExchangeHistoryPanel';
import { fetchLeadActivities } from '@/lib/api';
import { isSolutionHistoryLine, presentLeadHistory, type LeadHistoryLine } from '@/lib/crm/lead-history';

function mergeSolutionLines(fromProps: LeadHistoryLine[], fromFetch: LeadHistoryLine[]): LeadHistoryLine[] {
  const byKey = new Map<string, LeadHistoryLine>();
  for (const line of [...fromProps, ...fromFetch]) {
    if (!isSolutionHistoryLine(line)) continue;
    byKey.set(line.key || `activity-${line.id}`, line);
  }
  return [...byKey.values()].sort((a, b) => {
    const time = String(b.when).localeCompare(String(a.when));
    return time !== 0 ? time : (b.id || 0) - (a.id || 0);
  });
}

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
  const [fetched, setFetched] = useState<LeadHistoryLine[]>([]);
  useEffect(() => {
    let cancelled = false;
    void fetchLeadActivities(token, leadId, 80)
      .then((rows) => {
        if (cancelled) return;
        setFetched(rows.map((row) => presentLeadHistory(row)));
      })
      .catch(() => {
        if (!cancelled) setFetched([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token, leadId]);

  const solutionLines = useMemo(
    () => mergeSolutionLines(exchangeLines, fetched),
    [exchangeLines, fetched],
  );
  const otherExchange = exchangeLines.filter((line) => !isSolutionHistoryLine(line));
  return (
    <div className="lead-history-tab" data-testid="lead-history-tab">
      <section className="lead-panel" data-testid="lead-solution-history">
        <div className="lead-panel__head">
          <h3 className="lead-panel__title">Lịch sử Solution</h3>
        </div>
        {solutionLines.length === 0 ? (
          <p className="lead-empty-state">Chưa có sự kiện Solution.</p>
        ) : (
          <ul className="lead-activity-list">
            {solutionLines.map((line) => (
              <li key={line.key} className="lead-activity-item" data-testid="lead-solution-history-item">
                <div className="lead-activity-item__content">{line.what}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
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
        lines={otherExchange}
        selectedActivityId={selectedActivityId}
        onSelectActivity={onSelectActivity}
      />
    </div>
  );
}

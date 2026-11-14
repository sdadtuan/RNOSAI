'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchLeadActivities, fetchLeadFrSla, type LeadFrCallAttempt } from '@/lib/api';
import {
  presentLeadHistory,
  presentShortHistoryRow,
  splitLeadHistoryColumns,
  type LeadHistoryLine,
} from '@/lib/crm/lead-history';

function mergeActivityLines(fromProps: LeadHistoryLine[], fromFetch: LeadHistoryLine[]): LeadHistoryLine[] {
  const byKey = new Map<string, LeadHistoryLine>();
  for (const line of [...fromProps, ...fromFetch]) {
    byKey.set(line.key || `activity-${line.id}`, line);
  }
  return [...byKey.values()];
}

function HistoryColumn({
  title,
  testId,
  itemTestId,
  empty,
  lines,
  selectedActivityId,
  onSelectActivity,
}: {
  title: string;
  testId: string;
  itemTestId: string;
  empty: string;
  lines: LeadHistoryLine[];
  selectedActivityId: number | null;
  onSelectActivity: (id: number | null) => void;
}) {
  return (
    <section className="lead-panel lead-history-col" data-testid={testId}>
      <div className="lead-panel__head">
        <h3 className="lead-panel__title">{title}</h3>
      </div>
      {lines.length === 0 ? (
        <p className="lead-empty-state">{empty}</p>
      ) : (
        <ul className="lead-activity-list lead-history-col__list">
          {lines.map((line) => {
            const short = presentShortHistoryRow(line);
            const selectable =
              Number(line.id) > 0 &&
              !String(line.key).startsWith('call-') &&
              !String(line.key).startsWith('owner-') &&
              !String(line.key).startsWith('status-');
            return (
              <li
                key={line.key}
                className={`lead-activity-item lead-history-row${selectedActivityId === line.id ? ' is-selected' : ''}`}
                data-testid={itemTestId}
                title={short.title}
                onClick={selectable ? () => onSelectActivity(line.id) : undefined}
              >
                <div className="lead-history-row-inner">
                  <span className="lead-history-who">{short.who}</span>
                  <span className="lead-history-action">{short.action}</span>
                  {short.tag ? <span className="lead-history-tag">{short.tag}</span> : null}
                  <time className="lead-history-time">{short.clock}</time>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
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
  const [callAttempts, setCallAttempts] = useState<LeadFrCallAttempt[]>([]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetchLeadActivities(token, leadId, 80)
        .then((rows) => rows.map((row) => presentLeadHistory(row)))
        .catch(() => [] as LeadHistoryLine[]),
      fetchLeadFrSla(token, leadId)
        .then((sla) => sla.attempts ?? [])
        .catch(() => [] as LeadFrCallAttempt[]),
    ]).then(([activityLines, attempts]) => {
      if (cancelled) return;
      setFetched(activityLines);
      setCallAttempts(attempts);
    });
    return () => {
      cancelled = true;
    };
  }, [token, leadId]);

  const columns = useMemo(() => {
    return splitLeadHistoryColumns({
      activityLines: mergeActivityLines(exchangeLines, fetched),
      ownerLines,
      callAttempts,
    });
  }, [exchangeLines, fetched, ownerLines, callAttempts]);

  return (
    <div className="lead-history-tab" data-testid="lead-history-tab">
      <HistoryColumn
        title="Lịch sử Sale xử lý"
        testId="lead-sale-history"
        itemTestId="lead-sale-history-item"
        empty="Chưa có hoạt động Sale."
        lines={columns.saleLines}
        selectedActivityId={selectedActivityId}
        onSelectActivity={onSelectActivity}
      />
      <HistoryColumn
        title="Lịch sử Lead"
        testId="lead-lead-history"
        itemTestId="lead-lead-history-item"
        empty="Chưa có hoạt động Lead."
        lines={columns.leadLines}
        selectedActivityId={selectedActivityId}
        onSelectActivity={onSelectActivity}
      />
    </div>
  );
}

'use client';

import type { LeadHistoryLine } from '@/lib/crm/lead-history';

export function LeadExchangeHistoryPanel({
  lines,
  selectedActivityId,
  onSelectActivity,
}: {
  lines: LeadHistoryLine[];
  selectedActivityId: number | null;
  onSelectActivity: (id: number | null) => void;
}) {
  return (
    <section
      className="lead-panel lead-panel--activity"
      id="lead-activity-history"
      data-testid="lead-exchange-history"
    >
      <div className="lead-panel__head">
        <h3 className="lead-panel__title">Lịch sử trao đổi</h3>
      </div>
      {lines.length === 0 ? (
        <p className="lead-empty-state">Chưa có lịch sử trao đổi.</p>
      ) : (
        <ul className="lead-activity-list">
          {lines.map((line) => {
            const selectable = line.key.startsWith('activity-');
            return (
              <li
                key={line.key}
                className={`lead-activity-item ${selectable && selectedActivityId === line.id ? 'is-selected' : ''}`}
                onClick={() => {
                  if (selectable) onSelectActivity(line.id);
                }}
                onKeyDown={(e) => {
                  if (!selectable) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectActivity(line.id);
                  }
                }}
                role={selectable ? 'button' : undefined}
                tabIndex={selectable ? 0 : undefined}
                aria-pressed={selectable ? selectedActivityId === line.id : undefined}
              >
                <div className="lead-activity-item__meta">
                  <strong>{line.who}</strong>
                  {line.when ? <time>{line.when}</time> : null}
                </div>
                <div className="lead-activity-item__content">{line.what}</div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

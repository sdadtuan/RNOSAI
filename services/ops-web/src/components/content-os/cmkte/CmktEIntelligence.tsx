'use client';

import { useMemo, useState } from 'react';
import type { ContentOsIntelligence } from '@/lib/content-os-api';
import type { PortfolioInsight } from '@/lib/crm/cmkte-api';

export const INTEL_COPILOT_WARNING = 'Copilot không dùng';
export const INTEL_EMPTY = 'Chưa có insight trong phạm vi lifecycle đã chọn.';

export function CmktEIntelligence({
  summary,
  scoped,
  insights = [],
  canApprove = true,
  onApprove,
  approving = false,
}: {
  summary: ContentOsIntelligence | null;
  scoped: boolean;
  insights?: PortfolioInsight[];
  canApprove?: boolean;
  onApprove?: (insightId: number) => Promise<void> | void;
  approving?: boolean;
}) {
  const suggestions = summary?.suggestions ?? [];
  const topItems = summary?.top_items ?? [];
  const drafts = useMemo(() => insights.filter((row) => row.status === 'Draft'), [insights]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = insights.find((row) => row.id === selectedId) ?? null;
  const canApproveSelected = Boolean(canApprove && selected?.status === 'Draft' && onApprove);
  const empty = !scoped || (!suggestions.length && !topItems.length && !summary?.weekly_memo && !insights.length);

  async function handleApprove() {
    if (!canApproveSelected || selectedId == null || !onApprove) return;
    await onApprove(selectedId);
    setSelectedId(null);
  }

  return (
    <div className="cmkte-reqpage">
      <div className="cmkte-head">
        <div>
          <h1>Content Intelligence</h1>
          <p>Vòng lặp performance → insight → brief / AI context. Chỉ insight Approved mới vào Copilot.</p>
        </div>
        <div className="cmkte-actions">
          <button type="button" className="cmkte-btn" disabled>
            Export insight
          </button>
          {canApprove ? (
            <button
              type="button"
              className="cmkte-btn cmkte-btn--blue"
              disabled={!canApproveSelected || approving}
              onClick={() => void handleApprove()}
            >
              Approve insight
            </button>
          ) : null}
        </div>
      </div>

      <div className="cmkte-layout">
        <div className="cmkte-card">
          <h3>
            Insight draft <span className="cmkte-tag cmkte-tag--amber">Draft</span>
          </h3>
          {drafts.length ? (
            <div className="cmkte-notice cmkte-notice--warn">
              <b>{INTEL_COPILOT_WARNING}</b>
              <span>Chưa Approved — không dùng làm grounded context.</span>
            </div>
          ) : null}
          {!scoped ? (
            <p className="cmkte-empty">Chưa chọn lifecycle — không gọi intelligence.</p>
          ) : null}
          {empty && scoped ? <p className="cmkte-empty">{INTEL_EMPTY}</p> : null}
          {insights.length ? (
            <ul className="cmkte-list">
              {insights.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className={selectedId === row.id ? 'cmkte-btn cmkte-btn--small cmkte-btn--blue' : 'cmkte-btn cmkte-btn--small'}
                    onClick={() => setSelectedId(row.id)}
                  >
                    #{row.id} · {row.status} · {row.pattern}
                  </button>
                  {row.evidence ? <span className="cmkte-desc"> {row.evidence}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
          {suggestions.length ? (
            <ul className="cmkte-list">
              {suggestions.map((row) => (
                <li key={row}>{row}</li>
              ))}
            </ul>
          ) : null}
          {topItems.length ? (
            <ul className="cmkte-list">
              {topItems.map((row) => (
                <li key={row.item_id}>
                  {row.title} · {row.channel} · score {row.score}
                </li>
              ))}
            </ul>
          ) : null}
          {summary?.weekly_memo?.body_vi ? (
            <p className="cmkte-desc">{summary.weekly_memo.body_vi}</p>
          ) : null}
        </div>
        <div className="cmkte-card">
          <h3>Scope</h3>
          <p className="cmkte-desc">{scoped ? `Lifecycle đã chọn` : '—'}</p>
        </div>
      </div>
    </div>
  );
}

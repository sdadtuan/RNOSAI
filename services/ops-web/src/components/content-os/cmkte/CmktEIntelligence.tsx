'use client';

import React, { useMemo, useState } from 'react';
import type { ContentOsIntelligence } from '@/lib/content-os-api';
import type { PortfolioGlossary, PortfolioInsight } from '@/lib/crm/cmkte-api';

export const INTEL_COPILOT_WARNING = 'Copilot không dùng';
export const INTEL_EMPTY = 'Chưa có insight trong phạm vi lifecycle đã chọn.';
export const INTEL_LOAD_ERROR = 'Không tải được insight';

export function insightEmptyCopy(hasError: boolean | undefined): string {
  return hasError ? INTEL_LOAD_ERROR : INTEL_EMPTY;
}

export function CmktEIntelligence({
  summary,
  scoped,
  insights = [],
  glossary = [],
  canApprove = true,
  onApprove,
  onApproveGlossary,
  approving = false,
  loadError = false,
}: {
  summary: ContentOsIntelligence | null;
  scoped: boolean;
  insights?: PortfolioInsight[];
  glossary?: PortfolioGlossary[];
  canApprove?: boolean;
  onApprove?: (insightId: number) => Promise<void> | void;
  onApproveGlossary?: (glossaryId: number) => Promise<void> | void;
  approving?: boolean;
  loadError?: boolean;
}) {
  const suggestions = summary?.suggestions ?? [];
  const topItems = summary?.top_items ?? [];
  const drafts = useMemo(() => insights.filter((row) => row.status === 'Draft'), [insights]);
  const glossaryDrafts = useMemo(() => glossary.filter((row) => row.status === 'Draft'), [glossary]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedGlossaryId, setSelectedGlossaryId] = useState<number | null>(null);
  const selected = insights.find((row) => row.id === selectedId) ?? null;
  const selectedGlossary = glossary.find((row) => row.id === selectedGlossaryId) ?? null;
  const canApproveSelected = Boolean(canApprove && selected?.status === 'Draft' && onApprove);
  const canApproveGlossary = Boolean(
    canApprove && selectedGlossary?.status === 'Draft' && onApproveGlossary,
  );
  const empty =
    !scoped ||
    (!suggestions.length && !topItems.length && !summary?.weekly_memo && !insights.length && !glossary.length);

  async function handleApprove() {
    if (!canApproveSelected || selectedId == null || !onApprove) return;
    await onApprove(selectedId);
    setSelectedId(null);
  }

  async function handleApproveGlossary() {
    if (!canApproveGlossary || selectedGlossaryId == null || !onApproveGlossary) return;
    await onApproveGlossary(selectedGlossaryId);
    setSelectedGlossaryId(null);
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
          {canApprove ? (
            <button
              type="button"
              className="cmkte-btn cmkte-btn--blue"
              disabled={!canApproveGlossary || approving}
              onClick={() => void handleApproveGlossary()}
            >
              Approve glossary
            </button>
          ) : null}
        </div>
      </div>

      <div className="cmkte-layout">
        <div className="cmkte-card">
          <h3>
            Insight draft <span className="cmkte-tag cmkte-tag--amber">Draft</span>
          </h3>
          {drafts.length || glossaryDrafts.length ? (
            <div className="cmkte-notice cmkte-notice--warn">
              <b>{INTEL_COPILOT_WARNING}</b>
              <span>Chưa Approved — không dùng làm grounded context.</span>
            </div>
          ) : null}
          {!scoped ? (
            <p className="cmkte-empty">Chưa chọn lifecycle — không gọi intelligence.</p>
          ) : null}
          {empty && scoped ? <p className="cmkte-empty">{insightEmptyCopy(loadError)}</p> : null}
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
          {glossary.length ? (
            <ul className="cmkte-list">
              {glossary.map((row) => (
                <li key={`glossary-${row.id}`}>
                  <button
                    type="button"
                    className={
                      selectedGlossaryId === row.id
                        ? 'cmkte-btn cmkte-btn--small cmkte-btn--blue'
                        : 'cmkte-btn cmkte-btn--small'
                    }
                    onClick={() => setSelectedGlossaryId(row.id)}
                  >
                    #{row.id} · {row.status} · {row.locale} · {row.term}
                  </button>
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

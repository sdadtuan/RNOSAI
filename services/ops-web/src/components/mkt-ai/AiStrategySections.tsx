'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DraftAutosaveHint } from '@/components/mkt-ai/DraftAutosaveHint';
import { useIntakeAutosave } from '@/lib/crm/use-intake-autosave';
import {
  STRATEGY_FIELD_ORDER,
  strategyDraftSnapshot,
  TMMT_CORE_KEYS,
  TMMT_PROF_FIELD_ORDER,
} from '@/lib/mkt-ai-draft-fields';
import { patchMktAiDraft, type MktAiDraft } from '@/lib/mkt-ai-planner-api';
import { STRATEGY_LABELS, TMMT_PROF_LABELS } from '@/lib/tmmt-labels';

const textareaStyle: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.55rem 0.75rem',
  color: 'var(--text)',
  width: '100%',
  minHeight: '4.5rem',
  resize: 'vertical',
  fontSize: '0.85rem',
  lineHeight: 1.45,
};

interface Props {
  token: string;
  lifecycleId: number;
  strategyFramework: Record<string, string>;
  targetMarketProf: Record<string, string>;
  swotJson: Record<string, unknown>;
  canEdit: boolean;
  paused?: boolean;
  resetAutosaveKey?: string | number;
  briefReady?: boolean;
  qualityScore?: number;
  onGenerate?: () => void;
  onRetry?: () => void;
  onDraftPersisted: (draft: MktAiDraft) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onSaveError?: (message: string) => void;
  onContinue?: () => void;
}

function swotLists(swot: Record<string, unknown>): Record<string, string[]> {
  const pick = (k: string) =>
    Array.isArray(swot[k])
      ? (swot[k] as unknown[]).map((x) => String(x)).filter(Boolean)
      : [];
  return {
    strengths: pick('strengths'),
    weaknesses: pick('weaknesses'),
    opportunities: pick('opportunities'),
    threats: pick('threats'),
  };
}

export function AiStrategySections({
  token,
  lifecycleId,
  strategyFramework,
  targetMarketProf,
  swotJson,
  canEdit,
  paused = false,
  resetAutosaveKey,
  briefReady = false,
  qualityScore,
  onGenerate,
  onRetry,
  onDraftPersisted,
  onDirtyChange,
  onSaveError,
  onContinue,
}: Props) {
  const [sf, setSf] = useState(strategyFramework);
  const [prof, setProf] = useState(targetMarketProf);

  useEffect(() => {
    setSf(strategyFramework);
    setProf(targetMarketProf);
  }, [strategyFramework, targetMarketProf, resetAutosaveKey]);

  const snapshot = useMemo(() => strategyDraftSnapshot(sf, prof), [sf, prof]);

  const persistDraft = useCallback(async () => {
    const draft = await patchMktAiDraft(token, lifecycleId, {
      strategy_framework: sf,
      target_market_prof: prof,
    });
    onDraftPersisted(draft);
  }, [lifecycleId, onDraftPersisted, prof, sf, token]);

  const autosave = useIntakeAutosave({
    enabled: canEdit,
    paused,
    snapshot,
    onSave: persistDraft,
    debounceMs: 1000,
  });

  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  useEffect(() => {
    autosave.syncSnapshot(snapshotRef.current);
  }, [resetAutosaveKey, autosave.syncSnapshot]);

  useEffect(() => {
    onDirtyChange?.(autosave.dirty);
  }, [autosave.dirty, onDirtyChange]);

  const hasContent =
    Object.values(sf).some((v) => String(v).trim()) ||
    Object.values(prof).some((v) => String(v).trim());

  const swot = swotLists(swotJson);

  async function flushAndContinue() {
    if (!canEdit) {
      onContinue?.();
      return;
    }
    if (autosave.dirty) {
      try {
        await persistDraft();
        autosave.markSavedNow(snapshot);
      } catch (err) {
        onSaveError?.(err instanceof Error ? err.message : 'Lưu draft thất bại');
        return;
      }
    }
    onContinue?.();
  }

  function handleRetry() {
    if (autosave.dirty) {
      const ok = window.confirm(
        'Bạn đã chỉnh sửa draft thủ công. Sinh lại sẽ ghi đè phần chiến lược từ AI. Tiếp tục?',
      );
      if (!ok) return;
    }
    onRetry?.();
  }

  return (
    <div className="card" style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {canEdit ? (
          <>
            <button
              type="button"
              className="btn btn-sm"
              disabled={paused || !briefReady}
              onClick={() => onGenerate?.()}
            >
              Sinh chiến lược AI
            </button>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={paused}
              onClick={() => handleRetry()}
            >
              Sinh lại ↻
            </button>
          </>
        ) : null}
        {qualityScore != null ? (
          <span className="muted">
            Chất lượng: <strong>{qualityScore}/100</strong>
          </span>
        ) : null}
        {canEdit ? (
          <DraftAutosaveHint
            status={autosave.status}
            savedAt={autosave.savedAt}
            dirty={autosave.dirty}
            entityLabel="chiến lược"
          />
        ) : null}
      </div>

      {!hasContent ? (
        <p className="muted" style={{ margin: 0 }}>
          Hoàn thiện Brief rồi bấm Sinh chiến lược AI
        </p>
      ) : (
        <>
          <section>
            <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Khung chiến lược</h4>
            <div style={{ display: 'grid', gap: '0.65rem' }}>
              {STRATEGY_FIELD_ORDER.map((key) => (
                <label key={key} style={{ display: 'grid', gap: '0.3rem' }}>
                  <span className="muted" style={{ fontSize: '0.8rem' }}>
                    {STRATEGY_LABELS[key] ?? key}
                  </span>
                  {canEdit ? (
                    <textarea
                      style={textareaStyle}
                      value={sf[key] ?? ''}
                      onChange={(e) => setSf((prev) => ({ ...prev, [key]: e.target.value }))}
                      onBlur={() => autosave.saveOnBlur()}
                    />
                  ) : (
                    <div style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                      {sf[key] || '—'}
                    </div>
                  )}
                </label>
              ))}
            </div>
          </section>

          <section>
            <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>TMMT chi tiết (draft)</h4>
            <div style={{ display: 'grid', gap: '0.65rem' }}>
              {TMMT_PROF_FIELD_ORDER.map((key) => (
                <label key={key} style={{ display: 'grid', gap: '0.3rem' }}>
                  <span className="muted" style={{ fontSize: '0.8rem' }}>
                    {TMMT_PROF_LABELS[key] ?? key}
                    {TMMT_CORE_KEYS.has(key) ? ' *' : ''}
                  </span>
                  {canEdit ? (
                    <textarea
                      style={textareaStyle}
                      value={prof[key] ?? ''}
                      onChange={(e) => setProf((prev) => ({ ...prev, [key]: e.target.value }))}
                      onBlur={() => autosave.saveOnBlur()}
                    />
                  ) : (
                    <div style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                      {prof[key] || '—'}
                    </div>
                  )}
                </label>
              ))}
            </div>
          </section>

          {(swot.strengths.length ||
            swot.weaknesses.length ||
            swot.opportunities.length ||
            swot.threats.length) > 0 ? (
            <section>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>SWOT (AI — chỉ đọc)</h4>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: '0.5rem',
                  fontSize: '0.85rem',
                }}
              >
                {(
                  [
                    ['Strengths', swot.strengths],
                    ['Weaknesses', swot.weaknesses],
                    ['Opportunities', swot.opportunities],
                    ['Threats', swot.threats],
                  ] as const
                ).map(([title, items]) => (
                  <div key={title} className="card" style={{ padding: '0.65rem 0.75rem' }}>
                    <div className="muted" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      {title}
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                      {items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      {onContinue ? (
        <button type="button" className="btn btn-sm btn-secondary" onClick={() => void flushAndContinue()}>
          Tiếp → Campaign
        </button>
      ) : null}
    </div>
  );
}

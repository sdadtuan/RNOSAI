'use client';

import { useEffect, useMemo, useState } from 'react';
import { IntakeBantTotalBar } from '@/components/crm/intake/IntakeBantTotalBar';
import { BANT_FIELD_LABELS } from '@/lib/crm/intake-labels';
import { BANT_KEYS, type BantKey } from '@/lib/crm/intake-bant';
import {
  BANT_CHECKLIST,
  bantChecklistTotal,
  type BantChecklistState,
} from '@/lib/crm/intake-bant-checklist';
import { groupHasMappedQuestions, hasBantDiscoveryEvidence } from '@/lib/crm/intake-bant-evidence';
import { nextBantStep } from '@/lib/crm/intake-bant-next-step';
import type { DiscoveryResponseEntry, IntakeQuestionItem } from '@/lib/crm/intake-questions';
import { gapToConsultLabel, gapToGo } from '@/lib/crm/intake-service-resolve';

type ScoreSuggestion = { score: 1 | 2 | 3 | 4 | 5; quote: string };

export type IntakeBantChecklistPanelProps = {
  checklist: BantChecklistState;
  canEdit: boolean;
  questionItems: IntakeQuestionItem[];
  checked: Record<string, boolean>;
  responses: Record<string, DiscoveryResponseEntry>;
  onToggle: (key: BantKey, score: number) => void;
  onFocusTab?: (tab: 'discovery' | 'qualify' | 'win_intel') => void;
  suggestEnabled?: boolean;
  suggestBusy?: boolean;
  suggestions?: Partial<Record<string, ScoreSuggestion>>;
  onRequestSuggest?: () => void;
  onClearSuggest?: () => void;
};

export function IntakeBantChecklistPanel({
  checklist,
  canEdit,
  questionItems,
  checked,
  responses,
  onToggle,
  onFocusTab,
  suggestEnabled = false,
  suggestBusy = false,
  suggestions,
  onRequestSuggest,
  onClearSuggest,
}: IntakeBantChecklistPanelProps) {
  const total = bantChecklistTotal(checklist);
  const step = nextBantStep({ checklist, questionItems, checked, responses });
  const suggestionEntries = useMemo(
    () =>
      Object.entries(suggestions ?? {}).filter(
        (row): row is [BantKey, ScoreSuggestion] =>
          BANT_KEYS.includes(row[0] as BantKey) && Boolean(row[1]),
      ),
    [suggestions],
  );
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [override, setOverride] = useState(false);

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const [key] of suggestionEntries) {
      next[key] = Number(checklist[key] ?? 0) === 0;
    }
    setPicked(next);
    setOverride(false);
    // Seed from incoming suggestions only; checklist is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestions]);

  return (
    <section className="lmp-panel lmp-cockpit intake-kit intake-kit--embedded intake-bant-drawer">
      <p className="muted intake-kit__subtitle intake-kit__subtitle--embedded">
        Tick đúng câu KH vừa nói — hệ thống tự chấm 1–5. Một mục chỉ chọn một dòng.
      </p>
      <IntakeBantTotalBar total={total} />

      {suggestEnabled ? (
        <article className="intake-bant-drawer__next">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!canEdit || suggestBusy}
            onClick={() => onRequestSuggest?.()}
          >
            {suggestBusy ? 'Đang gợi ý…' : 'Gợi ý chấm'}
          </button>
          {suggestionEntries.length > 0 ? (
            <>
              <ul className="intake-bant-drawer__items">
                {suggestionEntries.map(([key, item]) => (
                  <li key={key}>
                    <label className="intake-bant-drawer__item">
                      <input
                        type="checkbox"
                        checked={Boolean(picked[key])}
                        disabled={!canEdit}
                        onChange={(event) =>
                          setPicked((prev) => ({ ...prev, [key]: event.target.checked }))
                        }
                      />
                      <span className="intake-bant-drawer__item-score">{item.score}</span>
                      <span>
                        {BANT_FIELD_LABELS[key].label} — “{item.quote}”
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <label className="intake-bant-drawer__item">
                <input
                  type="checkbox"
                  checked={override}
                  disabled={!canEdit}
                  onChange={(event) => setOverride(event.target.checked)}
                />
                <span>Ghi đè</span>
              </label>
              <div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!canEdit}
                  onClick={() => {
                    for (const [key, item] of suggestionEntries) {
                      if (!picked[key]) continue;
                      const current = Number(checklist[key] ?? 0);
                      if (current === item.score) continue;
                      if (current > 0 && !override) continue;
                      onToggle(key, item.score);
                    }
                    onClearSuggest?.();
                  }}
                >
                  Áp dụng gợi ý
                </button>{' '}
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => onClearSuggest?.()}>
                  Bỏ
                </button>
              </div>
            </>
          ) : null}
        </article>
      ) : null}

      <article className="intake-bant-drawer__next">
        <h3>{step.title_vi}</h3>
        <p>{step.body_vi}</p>
        {step.cta === 'discovery' ? (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onFocusTab?.('discovery')}>
            Mở Discovery
          </button>
        ) : null}
        {step.cta === 'qualify' ? (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onFocusTab?.('qualify')}>
            Mở Qualify
          </button>
        ) : null}
      </article>

      <div className="intake-bant-drawer__list">
        {BANT_KEYS.map((key) => {
          const block = BANT_CHECKLIST[key];
          const selected = Number(checklist[key] ?? 0);
          const showWarn =
            selected >= 1 &&
            groupHasMappedQuestions(key, questionItems) &&
            !hasBantDiscoveryEvidence({
              bantKey: key,
              questionItems,
              checked,
              responses,
            });
          return (
            <section key={key} className="intake-bant-drawer__block">
              <header className="intake-bant-drawer__block-head">
                <strong>{BANT_FIELD_LABELS[key].label}</strong>
                <span className={selected ? 'intake-bant-drawer__score' : 'muted'}>
                  {selected ? `${selected}/5` : 'Chưa chấm'}
                </span>
              </header>
              <p className="muted intake-bant-drawer__hint">{block.hint}</p>
              <ul className="intake-bant-drawer__items">
                {block.items.map((item) => {
                  const id = `bant-check-${key}-${item.score}`;
                  const itemChecked = selected === item.score;
                  return (
                    <li key={item.score}>
                      <label className={`intake-bant-drawer__item${itemChecked ? ' is-checked' : ''}`} htmlFor={id}>
                        <input
                          id={id}
                          type="checkbox"
                          checked={itemChecked}
                          disabled={!canEdit}
                          onChange={() => onToggle(key, item.score)}
                        />
                        <span className="intake-bant-drawer__item-score">{item.score}</span>
                        <span>{item.label}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              {showWarn ? (
                <p className="intake-bant-drawer__warn" role="status">
                  Chưa có ghi chú Discovery cho mục này. Nên mở Discovery và ghi lời KH trước khi tin điểm.
                </p>
              ) : null}
            </section>
          );
        })}
      </div>
      <p className="muted intake-kit__footer">
        BANT {total}/30 · {gapToConsultLabel(gapToGo(total))}
      </p>
    </section>
  );
}

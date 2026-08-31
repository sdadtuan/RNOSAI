'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  WIN_CHECKLIST,
  winChecklistTotal,
  type WinChecklistState,
} from '@/lib/crm/intake-win-checklist';
import { winConsultLabel } from '@/lib/crm/intake-win-coverage';
import { WIN_SCORE_KEYS, type WinScoreKey } from '@/lib/crm/intake-win-score';

const WIN_FIELD_LABELS: Record<WinScoreKey, string> = {
  incumbent: 'Agency đang dùng',
  competitor: 'Đối thủ',
  selection_criteria: 'Tiêu chí chọn',
  switch_risk: 'Rủi ro đổi',
  champion: 'Champion',
  next_step: 'Bước tiếp',
};

type ScoreSuggestion = { score: 1 | 2 | 3 | 4 | 5; quote: string };

export type IntakeWinChecklistPanelProps = {
  checklist: WinChecklistState;
  canEdit: boolean;
  onToggle: (key: WinScoreKey, score: number) => void;
  suggestEnabled?: boolean;
  suggestBusy?: boolean;
  suggestions?: Partial<Record<string, ScoreSuggestion>>;
  onRequestSuggest?: () => void;
  onClearSuggest?: () => void;
};

export function IntakeWinChecklistPanel({
  checklist,
  canEdit,
  onToggle,
  suggestEnabled = false,
  suggestBusy = false,
  suggestions,
  onRequestSuggest,
  onClearSuggest,
}: IntakeWinChecklistPanelProps) {
  const total = winChecklistTotal(checklist);
  const suggestionEntries = useMemo(
    () =>
      Object.entries(suggestions ?? {}).filter(
        (row): row is [WinScoreKey, ScoreSuggestion] =>
          WIN_SCORE_KEYS.includes(row[0] as WinScoreKey) && Boolean(row[1]),
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
    <section className="lmp-panel lmp-cockpit intake-kit intake-kit--embedded intake-win-drawer">
      <p className="muted intake-kit__subtitle intake-kit__subtitle--embedded">
        Tick đúng câu KH vừa nói — hệ thống tự chấm 1–5. Một mục chỉ chọn một dòng.
      </p>

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
                        {WIN_FIELD_LABELS[key]} — “{item.quote}”
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

      <div className="intake-bant-drawer__list">
        {WIN_SCORE_KEYS.map((key) => {
          const block = WIN_CHECKLIST[key];
          const selected = Number(checklist[key] ?? 0);
          return (
            <section key={key} className="intake-bant-drawer__block">
              <header className="intake-bant-drawer__block-head">
                <strong>{WIN_FIELD_LABELS[key]}</strong>
                <span className={selected ? 'intake-bant-drawer__score' : 'muted'}>
                  {selected ? `${selected}/5` : 'Chưa chấm'}
                </span>
              </header>
              <p className="muted intake-bant-drawer__hint">{block.hint}</p>
              <ul className="intake-bant-drawer__items">
                {block.items.map((item) => {
                  const id = `win-check-${key}-${item.score}`;
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
            </section>
          );
        })}
      </div>
      <p className="muted intake-kit__footer">
        Win {total}/30 · {winConsultLabel(total)}
      </p>
    </section>
  );
}

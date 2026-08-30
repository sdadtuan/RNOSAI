'use client';

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

export type IntakeBantChecklistPanelProps = {
  checklist: BantChecklistState;
  canEdit: boolean;
  questionItems: IntakeQuestionItem[];
  checked: Record<string, boolean>;
  responses: Record<string, DiscoveryResponseEntry>;
  onToggle: (key: BantKey, score: number) => void;
  onFocusTab?: (tab: 'discovery' | 'qualify' | 'win_intel') => void;
};

export function IntakeBantChecklistPanel({
  checklist,
  canEdit,
  questionItems,
  checked,
  responses,
  onToggle,
  onFocusTab,
}: IntakeBantChecklistPanelProps) {
  const total = bantChecklistTotal(checklist);
  const step = nextBantStep({ checklist, questionItems, checked, responses });

  return (
    <section className="lmp-panel lmp-cockpit intake-kit intake-kit--embedded intake-bant-drawer">
      <p className="muted intake-kit__subtitle intake-kit__subtitle--embedded">
        Tick đúng câu KH vừa nói — hệ thống tự chấm 1–5. Một mục chỉ chọn một dòng.
      </p>
      <IntakeBantTotalBar total={total} />

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

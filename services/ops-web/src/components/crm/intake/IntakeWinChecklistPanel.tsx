'use client';

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

export type IntakeWinChecklistPanelProps = {
  checklist: WinChecklistState;
  canEdit: boolean;
  onToggle: (key: WinScoreKey, score: number) => void;
};

export function IntakeWinChecklistPanel({
  checklist,
  canEdit,
  onToggle,
}: IntakeWinChecklistPanelProps) {
  const total = winChecklistTotal(checklist);

  return (
    <section className="lmp-panel lmp-cockpit intake-kit intake-kit--embedded intake-win-drawer">
      <p className="muted intake-kit__subtitle intake-kit__subtitle--embedded">
        Tick đúng câu KH vừa nói — hệ thống tự chấm 1–5. Một mục chỉ chọn một dòng.
      </p>

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

'use client';

import {
  countDiscoveryChecked,
  type IntakeSessionMode,
} from '@/lib/crm/intake-discovery';
import { intakeModeLabel } from '@/lib/crm/intake-labels';

interface Props {
  questions: string[];
  mode: IntakeSessionMode;
  checked: Record<string, boolean>;
  notes: string;
  disabled?: boolean;
  onToggle: (index: number, next: boolean) => void;
  onNotesChange: (value: string) => void;
}

export function IntakeDiscoveryChecklist({
  questions,
  mode,
  checked,
  notes,
  disabled,
  onToggle,
  onNotesChange,
}: Props) {
  const done = countDiscoveryChecked(checked);
  const total = questions.length;
  const minSuggested = mode === 'phone' ? 8 : 6;

  return (
    <div className="intake-discovery-checklist">
      <div className="intake-discovery-checklist__head">
        <strong>Câu hỏi gợi ý — {intakeModeLabel(mode)}</strong>
        <span className="muted intake-discovery-checklist__progress">
          Đã hỏi {done}/{total} câu
          {done < minSuggested ? ` · gợi ý ≥${minSuggested}` : ''}
        </span>
      </div>

      {questions.length === 0 ? (
        <p className="muted">Đang tải câu hỏi khảo sát…</p>
      ) : (
        <ul className="intake-discovery-checklist__items">
          {questions.map((question, index) => {
            const key = String(index);
            const isChecked = Boolean(checked[key]);
            return (
              <li key={key}>
                <label className="intake-discovery-checklist__item">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={disabled}
                    onChange={(e) => onToggle(index, e.target.checked)}
                  />
                  <span>{question}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <label className="intake-field">
        <span className="muted">Ghi chú discovery</span>
        <textarea
          className="kpi-input intake-discovery-checklist__notes"
          rows={3}
          value={notes}
          disabled={disabled}
          placeholder="Insight thêm, objection, next step…"
          onChange={(e) => onNotesChange(e.target.value)}
        />
      </label>
    </div>
  );
}

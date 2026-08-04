'use client';

import { IntakeDiscoveryChecklist } from '@/components/crm/intake/IntakeDiscoveryChecklist';
import { RichTextField } from '@/components/crm/RichTextField';
import {
  countDiscoveryChecked,
  type IntakeSessionMode,
} from '@/lib/crm/intake-discovery';
import { intakeModeLabel } from '@/lib/crm/intake-labels';

interface Props {
  mode: IntakeSessionMode;
  questions: string[];
  checked: Record<string, boolean>;
  notes: string;
  contactName: string;
  need: string;
  disabled?: boolean;
  canChangeMode?: boolean;
  onModeChange?: (mode: IntakeSessionMode) => void;
  onContactNameChange: (value: string) => void;
  onNeedChange: (value: string) => void;
  onToggleQuestion: (index: number, next: boolean) => void;
  onNotesChange: (value: string) => void;
}

export function IntakeDiscoverySection({
  mode,
  questions,
  checked,
  notes,
  contactName,
  need,
  disabled,
  canChangeMode,
  onModeChange,
  onContactNameChange,
  onNeedChange,
  onToggleQuestion,
  onNotesChange,
}: Props) {
  const done = countDiscoveryChecked(checked);
  const total = questions.length;

  return (
    <details className="intake-discovery-section" open>
      <summary className="intake-discovery-section__summary">
        <span>
          B. Khảo sát &quot;Discovery&quot; · {intakeModeLabel(mode)}
          {total > 0 ? ` · ${done}/${total} câu` : ''}
        </span>
        {canChangeMode && onModeChange ? (
          <select
            className="kpi-select intake-discovery-section__mode"
            value={mode}
            disabled={disabled}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onModeChange(e.target.value as IntakeSessionMode)}
            aria-label='Loại phiên "Session mode"'
          >
            <option value="phone">Gọi điện &quot;Phone&quot;</option>
            <option value="in_person">Gặp trực tiếp &quot;In person&quot;</option>
          </select>
        ) : null}
      </summary>

      <div className="intake-discovery-section__body stack-gap">
        <label className="intake-field">
          <span className="muted">Liên hệ &quot;Contact&quot;</span>
          <input
            className="kpi-input"
            value={contactName}
            onChange={(e) => onContactNameChange(e.target.value)}
            disabled={disabled}
          />
        </label>

        <label className="intake-field">
          <span className="muted">Nhu cầu / điểm đau &quot;Need / Pain&quot;</span>
          <RichTextField
            value={need}
            onChange={onNeedChange}
            disabled={disabled}
            minHeight="14rem"
            placeholder="Mô tả pain point, bối cảnh DN, KPI mong muốn, ràng buộc…"
            ariaLabel='Nhu cầu / điểm đau "Need / Pain"'
          />
        </label>

        <IntakeDiscoveryChecklist
          questions={questions}
          mode={mode}
          checked={checked}
          notes={notes}
          disabled={disabled}
          onToggle={onToggleQuestion}
          onNotesChange={onNotesChange}
        />
      </div>
    </details>
  );
}

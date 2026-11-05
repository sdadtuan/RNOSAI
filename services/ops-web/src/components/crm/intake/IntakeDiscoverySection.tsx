'use client';

import { IntakeDiscoveryChecklist } from '@/components/crm/intake/IntakeDiscoveryChecklist';
import {
  countDiscoveryChecked,
  type DiscoveryResponseEntry,
  type IntakeQuestionItem,
  type IntakeSessionMode,
} from '@/lib/crm/intake-discovery';
import { intakeModeLabel } from '@/lib/crm/intake-labels';

interface Props {
  mode: IntakeSessionMode;
  questionItems: IntakeQuestionItem[];
  checked: Record<string, boolean>;
  responses: Record<string, DiscoveryResponseEntry>;
  notes: string;
  disabled?: boolean;
  canChangeMode?: boolean;
  onModeChange?: (mode: IntakeSessionMode) => void;
  onToggleQuestion: (questionKey: string, next: boolean) => void;
  onResponseChange: (questionKey: string, patch: Partial<DiscoveryResponseEntry>) => void;
  onNotesChange: (value: string) => void;
  /** Persist draft when leaving Discovery fields (blur tab panel). */
  onPersistBlur?: () => void;
}

export function IntakeDiscoverySection({
  mode,
  questionItems,
  checked,
  responses,
  notes,
  disabled,
  canChangeMode,
  onModeChange,
  onToggleQuestion,
  onResponseChange,
  onNotesChange,
  onPersistBlur,
}: Props) {
  const done = countDiscoveryChecked(checked);
  const total = questionItems.length;
  const optionalItems = questionItems.filter((item) => !item.critical);

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

      <div
        className="intake-discovery-section__body stack-gap"
        onBlur={(e) => {
          if (!onPersistBlur) return;
          const next = e.relatedTarget as Node | null;
          if (next && e.currentTarget.contains(next)) return;
          onPersistBlur();
        }}
      >
        {optionalItems.length === 0 ? (
          <p className="muted">Câu bắt buộc đã nằm ở phần Cần điền để lưu.</p>
        ) : (
        <IntakeDiscoveryChecklist
          questionItems={optionalItems}
          mode={mode}
          checked={checked}
          responses={responses}
          notes={notes}
          disabled={disabled}
          onToggle={onToggleQuestion}
          onResponseChange={onResponseChange}
          onNotesChange={onNotesChange}
        />
        )}
      </div>
    </details>
  );
}

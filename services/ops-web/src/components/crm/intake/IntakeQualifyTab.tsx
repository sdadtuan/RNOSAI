'use client';

import { IntakeBantSection } from '@/components/crm/intake/IntakeBantSection';
import { IntakeRedFlagsSection } from '@/components/crm/intake/IntakeRedFlagsSection';
import { IntakeValidationErrors } from '@/components/crm/intake/IntakeValidationErrors';
import type { IntakeQuestionItem, IntakeRedFlagItem } from '@/lib/crm/intake-questions';
import type { IntakeRedFlagsState } from '@/lib/crm/intake-red-flags';
import type { IntakeValidationIssue } from '@/lib/crm/intake-validation';

export type IntakeQualifyTabProps = {
  bant: Record<string, number>;
  decision: string;
  disabled: boolean;
  validationErrors: IntakeValidationIssue[];
  redFlagItems: IntakeRedFlagItem[];
  redFlags: IntakeRedFlagsState;
  qualifyItems: IntakeQuestionItem[];
  qualifyChecked: Record<string, boolean>;
  onOpenBant: () => void;
  onToggleRedFlag: (key: string, next: boolean) => void;
  onRedFlagNotesChange: (value: string) => void;
  onToggleQualify: (key: string, next: boolean) => void;
};

export function IntakeQualifyTab({
  bant,
  decision,
  disabled,
  validationErrors,
  redFlagItems,
  redFlags,
  qualifyItems,
  qualifyChecked,
  onOpenBant,
  onToggleRedFlag,
  onRedFlagNotesChange,
  onToggleQualify,
}: IntakeQualifyTabProps) {
  return (
    <>
      <section className="intake-bant-section stack-gap" aria-label="Quyết định">
        <header className="intake-form__head">
          <h2 className="intake-form__title">Chấm điểm</h2>
          <p className="muted" style={{ margin: '0.25rem 0 0' }}>
            Quyết định nằm ở phần Cần điền để lưu phía trên.
          </p>
        </header>

        <div className="intake-bant-decision-pane">
          <IntakeBantSection bant={bant} decision={decision} onOpenBant={onOpenBant} />
          <IntakeValidationErrors issues={validationErrors} />
        </div>
      </section>

      {qualifyItems.length > 0 ? (
        <section className="intake-qualify-checklist stack-gap" aria-label="Lead — Qualify">
          <header className="intake-form__head">
            <h2 className="intake-form__title">Lead — Qualify</h2>
          </header>
          <ul className="intake-red-flags-section__list">
            {qualifyItems.map((item) => (
              <li key={item.key}>
                <label className="intake-red-flags-section__item">
                  <input
                    type="checkbox"
                    checked={Boolean(qualifyChecked[item.key])}
                    disabled={disabled}
                    onChange={(e) => onToggleQualify(item.key, e.target.checked)}
                  />
                  <span>
                    {item.text}
                    {item.critical ? (
                      <>
                        <span className="intake-required-mark" title="Cần có dữ liệu">
                          *
                        </span>
                        <span className="intake-discovery-checklist__critical"> Quan trọng</span>
                      </>
                    ) : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <IntakeRedFlagsSection
        items={redFlagItems}
        state={redFlags}
        disabled={disabled}
        onToggle={onToggleRedFlag}
        onNotesChange={onRedFlagNotesChange}
      />
    </>
  );
}

'use client';

import type { FocusEvent } from 'react';
import { IntakeBantSection } from '@/components/crm/intake/IntakeBantSection';
import { IntakeRedFlagsSection } from '@/components/crm/intake/IntakeRedFlagsSection';
import { IntakeValidationErrors } from '@/components/crm/intake/IntakeValidationErrors';
import { INTAKE_DECISION_OPTIONS } from '@/lib/crm/intake-labels';
import type { BantKey, BantRowUi } from '@/lib/crm/intake-bant';
import type { IntakeQuestionItem, IntakeRedFlagItem } from '@/lib/crm/intake-questions';
import type { IntakeRedFlagsState } from '@/lib/crm/intake-red-flags';
import type { IntakeValidationIssue } from '@/lib/crm/intake-validation';

export type IntakeQualifyTabProps = {
  bant: Record<string, number>;
  bantRows: BantRowUi[];
  decision: string;
  decisionReason: string;
  disabled: boolean;
  validationErrors: IntakeValidationIssue[];
  redFlagItems: IntakeRedFlagItem[];
  redFlags: IntakeRedFlagsState;
  qualifyItems: IntakeQuestionItem[];
  qualifyChecked: Record<string, boolean>;
  onBantChange: (key: BantKey, value: number) => void;
  onDecisionChange: (value: string) => void;
  onDecisionReasonChange: (value: string) => void;
  onBantDecisionBlur: (event: FocusEvent<HTMLDivElement>) => void;
  onToggleRedFlag: (key: string, next: boolean) => void;
  onRedFlagNotesChange: (value: string) => void;
  onToggleQualify: (key: string, next: boolean) => void;
};

export function IntakeQualifyTab({
  bant,
  bantRows,
  decision,
  decisionReason,
  disabled,
  validationErrors,
  redFlagItems,
  redFlags,
  qualifyItems,
  qualifyChecked,
  onBantChange,
  onDecisionChange,
  onDecisionReasonChange,
  onBantDecisionBlur,
  onToggleRedFlag,
  onRedFlagNotesChange,
  onToggleQualify,
}: IntakeQualifyTabProps) {
  return (
    <>
      <section className="intake-bant-section stack-gap" aria-label='Chấm BANT "BANT scoring"'>
        <header className="intake-form__head">
          <h2 className="intake-form__title">C. BANT + Quyết định</h2>
        </header>

        <div className="intake-bant-decision-pane" onBlur={onBantDecisionBlur}>
          <IntakeBantSection
            bant={bant}
            bantRows={bantRows}
            decision={decision}
            disabled={disabled}
            onBantChange={onBantChange}
          />

          <IntakeValidationErrors issues={validationErrors} />

          <label className="intake-field">
            <span className="muted">Quyết định &quot;Decision&quot;</span>
            <select
              className="kpi-select"
              value={decision}
              onChange={(e) => onDecisionChange(e.target.value)}
              disabled={disabled}
            >
              {INTAKE_DECISION_OPTIONS.map((d) => (
                <option key={d.value || 'empty'} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>

          <label className="intake-field">
            <span className="muted">Lý do &quot;Reason&quot;</span>
            <input
              className="kpi-input"
              value={decisionReason}
              onChange={(e) => onDecisionReasonChange(e.target.value)}
              disabled={disabled}
            />
          </label>
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
                      <span className="intake-discovery-checklist__critical"> · Quan trọng</span>
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

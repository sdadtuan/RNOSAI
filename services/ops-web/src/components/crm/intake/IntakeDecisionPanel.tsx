'use client';

import type { FocusEvent } from 'react';
import { INTAKE_DECISION_OPTIONS } from '@/lib/crm/intake-labels';
import type { IntakeValidationIssue } from '@/lib/crm/intake-validation';
import { IntakeValidationErrors } from '@/components/crm/intake/IntakeValidationErrors';

type Props = {
  decision: string;
  decisionReason: string;
  disabled?: boolean;
  validationErrors?: IntakeValidationIssue[];
  onDecisionChange: (value: string) => void;
  onDecisionReasonChange: (value: string) => void;
  onBlur?: (event: FocusEvent<HTMLDivElement>) => void;
};

export function IntakeDecisionPanel({
  decision,
  decisionReason,
  disabled,
  validationErrors = [],
  onDecisionChange,
  onDecisionReasonChange,
  onBlur,
}: Props) {
  return (
    <section
      id="intake-decision-panel"
      className="intake-decision-panel stack-gap"
      aria-label="Quyết định"
      onBlur={onBlur}
    >
      <p className="muted intake-decision-panel__hint">
        Chọn Go / Nurture / No-Go trước khi hoàn thành phiên. Go cần BANT ≥ 24 để giao Tư vấn.
      </p>

      <IntakeValidationErrors issues={validationErrors.filter((i) => i.code === 'decision' || i.code === 'decision_reason')} />

      <label className="intake-field">
        <span className="muted">
          Quyết định &quot;Decision&quot;
          <span className="intake-required-mark" title="Bắt buộc trước khi hoàn thành">
            *
          </span>
        </span>
        <select
          className="kpi-select"
          value={decision}
          onChange={(e) => onDecisionChange(e.target.value)}
          disabled={disabled}
          autoFocus
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
          placeholder={
            decision === 'nurture' || decision === 'no_go'
              ? 'Bắt buộc khi Nurture / No-Go'
              : 'Tuỳ chọn'
          }
        />
      </label>
    </section>
  );
}

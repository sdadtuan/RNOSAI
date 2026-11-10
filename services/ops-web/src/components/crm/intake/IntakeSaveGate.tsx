'use client';

import type { FocusEvent } from 'react';
import { IntakeDiscoveryChecklist } from '@/components/crm/intake/IntakeDiscoveryChecklist';
import { RichTextField } from '@/components/crm/RichTextField';
import { INTAKE_DECISION_OPTIONS } from '@/lib/crm/intake-labels';
import type { DiscoveryResponseEntry, IntakeQuestionItem, IntakeSessionMode } from '@/lib/crm/intake-discovery';
import { isRichTextEmpty } from '@/lib/crm/intake-validation';
import type { IntakeStakeholderRow } from '@/lib/crm/intake-stakeholders';

type Props = {
  serviceMissing: boolean;
  contactName: string;
  need: string;
  decision: string;
  decisionReason: string;
  disabled?: boolean;
  mode: IntakeSessionMode;
  criticalItems: IntakeQuestionItem[];
  checked: Record<string, boolean>;
  responses: Record<string, DiscoveryResponseEntry>;
  decisionMakerName: string;
  onContactNameChange: (value: string) => void;
  onNeedChange: (value: string) => void;
  onDecisionChange: (value: string) => void;
  onDecisionReasonChange: (value: string) => void;
  onDecisionBlur?: (event: FocusEvent<HTMLDivElement>) => void;
  onToggleQuestion: (questionKey: string, next: boolean) => void;
  onResponseChange: (questionKey: string, patch: Partial<DiscoveryResponseEntry>) => void;
  onDecisionMakerNameChange: (value: string) => void;
};

export function IntakeSaveGate({
  serviceMissing,
  contactName,
  need,
  decision,
  decisionReason,
  disabled,
  mode,
  criticalItems,
  checked,
  responses,
  decisionMakerName,
  onContactNameChange,
  onNeedChange,
  onDecisionChange,
  onDecisionReasonChange,
  onDecisionBlur,
  onToggleQuestion,
  onResponseChange,
  onDecisionMakerNameChange,
}: Props) {
  const reasonRequired = decision === 'nurture' || decision === 'no_go';
  const makerRequired = decision === 'go';

  return (
    <section className="intake-save-gate" aria-label="Cần điền để lưu">
      <header className="intake-save-gate__head">
        <h2>Cần điền để lưu</h2>
        <p>Những mục này phải có thì mới hoàn thành phiên. Phần còn lại ở các tab bên dưới.</p>
      </header>

      {serviceMissing ? (
        <p className="intake-save-gate__alert">Chọn dịch vụ trên thanh phía trên trước khi lưu.</p>
      ) : null}

      <label className={`intake-field${contactName.trim() ? '' : ' intake-save-gate__field--empty'}`}>
        <span className="muted">
          Liên hệ &quot;Contact&quot;
          <span className="intake-required-mark" title="Bắt buộc để lưu">
            *
          </span>
        </span>
        <input
          className="kpi-input"
          value={contactName}
          onChange={(e) => onContactNameChange(e.target.value)}
          disabled={disabled}
        />
      </label>

      <label className={`intake-field${isRichTextEmpty(need) ? ' intake-save-gate__field--empty' : ''}`}>
        <span className="muted">
          Nhu cầu / điểm đau &quot;Need / Pain&quot;
          <span className="intake-required-mark" title="Bắt buộc để lưu">
            *
          </span>
        </span>
        <RichTextField
          value={need}
          onChange={onNeedChange}
          disabled={disabled}
          minHeight="8rem"
          placeholder="Mô tả pain point, bối cảnh DN, KPI mong muốn, ràng buộc…"
          ariaLabel='Nhu cầu / điểm đau "Need / Pain" (bắt buộc)'
        />
      </label>

      {criticalItems.length > 0 ? (
        <div className="intake-save-gate__critical">
          <IntakeDiscoveryChecklist
            questionItems={criticalItems}
            mode={mode}
            checked={checked}
            responses={responses}
            notes=""
            disabled={disabled}
            hideHead
            hideNotes
            markIncomplete
            onToggle={onToggleQuestion}
            onResponseChange={onResponseChange}
            onNotesChange={() => undefined}
          />
        </div>
      ) : null}

      <div className="intake-save-gate__decision" onBlur={onDecisionBlur}>
        <label className={`intake-field${!decision ? ' intake-save-gate__field--empty' : ''}`}>
          <span className="muted">
            Quyết định &quot;Decision&quot;
            <span className="intake-required-mark" title="Bắt buộc để lưu">
              *
            </span>
          </span>
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

        <label
          className={`intake-field${reasonRequired && !decisionReason.trim() ? ' intake-save-gate__field--empty' : ''}`}
        >
          <span className="muted">
            Lý do &quot;Reason&quot;
            {reasonRequired ? (
              <span className="intake-required-mark" title="Bắt buộc khi Nurture hoặc No-Go">
                *
              </span>
            ) : null}
          </span>
          <input
            className="kpi-input"
            value={decisionReason}
            onChange={(e) => onDecisionReasonChange(e.target.value)}
            disabled={disabled}
            placeholder={reasonRequired ? 'Bắt buộc khi Nurture / No-Go' : 'Tuỳ chọn'}
          />
        </label>

        {makerRequired ? (
          <label className={`intake-field${decisionMakerName.trim() ? '' : ' intake-save-gate__field--empty'}`}>
            <span className="muted">
              Tên Decision Maker
              <span className="intake-required-mark" title="Bắt buộc khi chọn Go">
                *
              </span>
            </span>
            <input
              className="kpi-input"
              value={decisionMakerName}
              onChange={(e) => onDecisionMakerNameChange(e.target.value)}
              disabled={disabled}
              placeholder="Người quyết định cuối"
            />
          </label>
        ) : null}
      </div>
    </section>
  );
}

export function decisionMakerNameOf(rows: IntakeStakeholderRow[]): string {
  return rows.find((row) => row.role === 'decision_maker')?.name ?? '';
}

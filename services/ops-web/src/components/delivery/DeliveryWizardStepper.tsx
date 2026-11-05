'use client';

const STEPS = [
  'Thông tin cơ bản',
  'Phạm vi & Dịch vụ',
  'Kế hoạch & Milestone',
  'Ngân sách & Nguồn lực',
  'KPI & Xác nhận',
] as const;

type DeliveryWizardStepperProps = {
  current: number;
  showLaterSteps: boolean;
  onStepClick?: (step: number) => void;
};

export function DeliveryWizardStepper({ current, showLaterSteps, onStepClick }: DeliveryWizardStepperProps) {
  return (
    <ol className="delivery-wizard-steps">
      {STEPS.map((label, idx) => {
        const step = idx + 1;
        const hidden = step >= 2 && step <= 5 && !showLaterSteps && step > 1;
        if (hidden && step > 1 && !showLaterSteps) {
          // still show all 5 labels per spec; dim steps 2-5 when ingest-only after save
        }
        const active = step === current;
        const done = step < current;
        const disabled = step >= 4 && !showLaterSteps && step > current;
        return (
          <li
            key={label}
            className={`delivery-wizard-step${active ? ' is-active' : ''}${done ? ' is-done' : ''}`}
          >
            <button
              type="button"
              className="delivery-wizard-step__btn"
              disabled={disabled}
              onClick={() => onStepClick?.(step)}
            >
              <span className="delivery-wizard-step__num">{step}</span>
              <span className="delivery-wizard-step__label">{label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export { STEPS as DELIVERY_WIZARD_STEP_LABELS };

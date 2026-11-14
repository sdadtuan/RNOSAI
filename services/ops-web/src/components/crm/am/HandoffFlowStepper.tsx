'use client';

import type { HandoffFlowStepKey, HandoffFlowView } from '@/lib/crm/handoff-flow.util';
import { formatHandoffStamp, visibleHandoffFlowSteps } from '@/lib/crm/handoff-flow.util';
import './am-handoff-desk.css';

export function HandoffFlowStepper({
  view,
  onStepClick,
}: {
  view: HandoffFlowView;
  onStepClick?: (key: HandoffFlowStepKey) => void;
}) {
  const visible = visibleHandoffFlowSteps(view);
  return (
    <div className="ahd-stepper-wrap">
    <ol
      className="ahd-stepper"
      aria-label="Tiến độ bàn giao"
      data-testid="handoff-flow-stepper"
      style={{ ['--ahd-step-count' as string]: String(visible.steps.length) }}
    >
      {visible.steps.map((step) => (
        <li
          key={step.key}
          className={`ahd-step ahd-step--${step.state}${step.isActive ? ' is-active' : ''}`}
          data-step={step.key}
          data-state={step.state}
        >
          {onStepClick ? (
            <button type="button" className="ahd-step__hit" onClick={() => onStepClick(step.key)}>
              <StepInner step={step} />
            </button>
          ) : (
            <div className="ahd-step__hit">
              <StepInner step={step} />
            </div>
          )}
        </li>
      ))}
    </ol>
    </div>
  );
}

function StepInner({
  step,
}: {
  step: HandoffFlowView['steps'][number];
}) {
  return (
    <>
      <span className="ahd-step__index" aria-hidden="true">
        {step.state === 'done' ? (
          <svg viewBox="0 0 16 16" width="14" height="14">
            <path
              d="M3.2 8.2l3.1 3.1 6.5-6.6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          step.index
        )}
      </span>
      <span className="ahd-step__body">
        <span className="ahd-step__label">
          <span className="ahd-step__label-full">{step.label}</span>
          <span className="ahd-step__label-short">{step.shortLabel || step.label}</span>
        </span>
        {step.hint ? <span className="ahd-step__hint">{step.hint}</span> : null}
        {step.state === 'done' && step.at ? (
          <span className="ahd-step__time">{formatHandoffStamp(step.at)}</span>
        ) : null}
      </span>
    </>
  );
}

'use client';

import type { FunnelStepViewModel, PresalesFunnelStepKey } from '@/lib/crm/funnel-stepper.types';

export function LeadPipelineDoneAccordion({
  steps,
  onReview,
}: {
  steps: FunnelStepViewModel[];
  onReview: (key: PresalesFunnelStepKey) => void;
}) {
  const done = steps.filter((s) => s.state === 'done');
  if (done.length === 0) return null;

  return (
    <details className="lead-pipeline-done">
      <summary>Các bước đã xong</summary>
      <ul className="lead-pipeline-done__list">
        {done.map((step) => (
          <li key={step.key}>
            <span>{step.label}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onReview(step.key)}>
              Xem lại
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

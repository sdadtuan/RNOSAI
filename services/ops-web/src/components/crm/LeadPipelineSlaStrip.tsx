'use client';

import type { ReactNode } from 'react';

export function LeadPipelineSlaStrip(props: {
  worstLabel: string;
  countdown: string | null;
  state: 'ok' | 'warning' | 'breach';
  detail?: ReactNode;
}) {
  return (
    <div className="lead-pipeline-sla">
      <span className={`lead-pipeline-sla__pill is-${props.state}`}>{props.worstLabel}</span>
      {props.countdown ? <span className="lead-pipeline-sla__clock">{props.countdown}</span> : null}
      <details className="lead-pipeline-sla__detail">
        <summary>Chi tiết SLA</summary>
        {props.detail}
      </details>
    </div>
  );
}

'use client';

import type { CommandCenterResponse } from '@/lib/command-center-types';

type Props = {
  funnel: CommandCenterResponse['funnel'];
  title?: string;
  testId?: string;
};

export function CcFunnel({ funnel, title = 'Funnel & Bottleneck', testId = 'exec-funnel' }: Props) {
  const max = funnel.stages[0]?.value ?? 1;

  return (
    <article className="kpi-hub-card kpi-hub-funnel cc-funnel" data-testid={testId}>
      <header className="kpi-hub-card__head">
        <h2>{title}</h2>
      </header>
      {funnel.stages.length === 0 ? (
        <p className="cc-empty">Chưa có dữ liệu funnel.</p>
      ) : (
        <>
          <div className="kpi-hub-funnel__stages">
            {funnel.stages.map((stage, i) => {
              const widthPct = stage.value != null && max ? Math.max(8, (stage.value / max) * 100) : 8;
              return (
                <div key={stage.code} className="kpi-hub-funnel__stage">
                  <div className="kpi-hub-funnel__bar-wrap">
                    <div className="kpi-hub-funnel__bar" style={{ width: `${widthPct}%` }} />
                  </div>
                  <div className="kpi-hub-funnel__meta">
                    <strong>{stage.name}</strong>
                    <span>{stage.value != null ? stage.value.toLocaleString('vi-VN') : '—'}</span>
                    {stage.conversion_from_prev != null ? (
                      <span className="kpi-hub-funnel__conv">
                        {(stage.conversion_from_prev * 100).toFixed(1)}%
                      </span>
                    ) : null}
                  </div>
                  {i < funnel.stages.length - 1 ? (
                    <span className="kpi-hub-funnel__arrow" aria-hidden>
                      →
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
          {funnel.bottleneck.label ? (
            <aside className="kpi-hub-funnel__bottleneck">
              <span className="kpi-hub-funnel__bottleneck-label">{funnel.bottleneck.label}</span>
            </aside>
          ) : null}
        </>
      )}
    </article>
  );
}

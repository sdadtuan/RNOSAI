'use client';

import type { CommandCenterResponse } from '@/lib/command-center-types';

type Props = {
  sales: NonNullable<CommandCenterResponse['sales']>;
  testId?: string;
};

const STAGES = ['New', 'Qualified', 'Proposal', 'Negotiation', 'Won'];

export function SalesPipelineChart({ sales, testId = 'sales-pipeline' }: Props) {
  const stacks = sales.pipeline_stacks;
  const byStage = STAGES.map((stage) => {
    const found = stacks.find((s) => s.stage === stage);
    return { stage, amount: found?.amount ?? null };
  });
  const max = Math.max(...byStage.map((s) => s.amount ?? 0), 1);

  return (
    <article className="kpi-hub-card cc-pipeline" data-testid={testId}>
      <header className="kpi-hub-card__head">
        <h2>Pipeline & Dự báo doanh thu</h2>
      </header>
      {stacks.length === 0 ? (
        <p className="cc-empty">Chưa có dữ liệu pipeline theo giai đoạn.</p>
      ) : (
        <div className="cc-pipeline__bars">
          {byStage.map((s) => {
            const widthPct = s.amount != null ? Math.max(4, (s.amount / max) * 100) : 4;
            return (
              <div key={s.stage} className="cc-pipeline__row">
                <span className="cc-pipeline__label">{s.stage}</span>
                <div className="cc-pipeline__bar-wrap">
                  <div className="cc-pipeline__bar" style={{ width: `${widthPct}%` }} />
                </div>
                <span className="cc-pipeline__value">
                  {s.amount != null ? s.amount.toLocaleString('vi-VN') : '—'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

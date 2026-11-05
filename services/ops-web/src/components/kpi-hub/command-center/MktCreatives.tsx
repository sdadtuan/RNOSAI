'use client';

import type { CommandCenterResponse } from '@/lib/command-center-types';

type Props = {
  marketing: NonNullable<CommandCenterResponse['marketing']>;
  testId?: string;
};

export function MktCreatives({ marketing, testId = 'mkt-creatives' }: Props) {
  const creatives = marketing.creatives;

  return (
    <article className="kpi-hub-card cc-creatives" data-testid={testId}>
      <header className="kpi-hub-card__head">
        <h2>Top Creative</h2>
      </header>
      {!marketing.grain.creative || creatives.length === 0 ? (
        <p className="cc-empty">Chưa có creative</p>
      ) : (
        <ul className="cc-creatives__list">
          {creatives.slice(0, 3).map((c, i) => (
            <li key={String(c.id ?? i)} className="cc-creatives__item">
              <div className="cc-creatives__thumb" aria-hidden />
              <div>
                <strong>{String(c.name ?? `Creative ${i + 1}`)}</strong>
                <span className="muted">
                  CTR {c.ctr != null ? String(c.ctr) : '—'} · CPL {c.cpl != null ? String(c.cpl) : '—'}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

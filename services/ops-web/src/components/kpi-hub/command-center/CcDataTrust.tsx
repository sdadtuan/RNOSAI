'use client';

import type { CSSProperties } from 'react';
import type { CommandCenterResponse } from '@/lib/command-center-types';
import { KpiHubStatusBadge } from '../KpiHubStatusBadge';

type Props = {
  trust: CommandCenterResponse['trust'];
  testId?: string;
};

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
  } catch {
    return '—';
  }
}

export function CcDataTrust({ trust, testId = 'exec-trust' }: Props) {
  const score = trust.score;

  return (
    <article className="kpi-hub-card cc-trust" data-testid={testId}>
      <header className="kpi-hub-card__head">
        <h2>Data Trust & Freshness</h2>
      </header>
      <div className="cc-trust__gauge-wrap">
        <div
          className="cc-trust__gauge"
          style={{ '--cc-score': score ?? 0 } as CSSProperties}
          aria-label={score != null ? `Overall Score ${score}` : 'Overall Score không có'}
        >
          <span className="cc-trust__score">{score != null ? score : '—'}</span>
          <span className="muted">Overall Score</span>
        </div>
      </div>
      <table className="kpi-hub-table cc-trust__table">
        <thead>
          <tr>
            <th>Nguồn</th>
            <th>Trạng thái</th>
            <th>Cập nhật</th>
          </tr>
        </thead>
        <tbody>
          {trust.sources.length === 0 ? (
            <tr>
              <td colSpan={3} className="cc-empty">
                Chưa có thông tin nguồn.
              </td>
            </tr>
          ) : (
            trust.sources.map((src) => (
              <tr key={src.system}>
                <td>{src.system}</td>
                <td>
                  <KpiHubStatusBadge kind="source" status={src.status} />
                </td>
                <td>{formatTime(src.last_success_at)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </article>
  );
}

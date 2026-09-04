'use client';

import type { CommandCenterResponse } from '@/lib/command-center-types';

type Props = {
  marketing: NonNullable<CommandCenterResponse['marketing']>;
  testId?: string;
};

export function MktChannelDonut({ marketing, testId = 'mkt-channel-donut' }: Props) {
  const channels = marketing.channels;

  return (
    <article className="kpi-hub-card cc-donut" data-testid={testId}>
      <header className="kpi-hub-card__head">
        <h2>Phân bổ ngân sách & Hiệu quả</h2>
      </header>
      {channels.length === 0 ? (
        <p className="cc-empty">Chưa có breakdown kênh</p>
      ) : (
        <>
          <div className="cc-donut__viz" aria-hidden>
            <svg viewBox="0 0 120 120" className="cc-donut__svg">
              {(() => {
                let offset = 0;
                const colors = ['#17692f', '#059669', '#34d399', '#6ee7b7'];
                return channels.map((ch, i) => {
                  const pct = ch.pct ?? 0;
                  const dash = `${pct * 283} 283`;
                  const el = (
                    <circle
                      key={ch.channel}
                      cx="60"
                      cy="60"
                      r="45"
                      fill="none"
                      stroke={colors[i % colors.length]}
                      strokeWidth="18"
                      strokeDasharray={dash}
                      strokeDashoffset={-offset * 283}
                      transform="rotate(-90 60 60)"
                    />
                  );
                  offset += pct;
                  return el;
                });
              })()}
            </svg>
          </div>
          <table className="kpi-hub-table">
            <thead>
              <tr>
                <th>Channel</th>
                <th>%</th>
                <th>Spend</th>
                <th>CPL</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((ch) => (
                <tr key={ch.channel}>
                  <td>{ch.channel}</td>
                  <td>{ch.pct != null ? `${(ch.pct * 100).toFixed(1)}%` : '—'}</td>
                  <td>{ch.spend != null ? ch.spend.toLocaleString('vi-VN') : '—'}</td>
                  <td>{ch.cpl != null ? ch.cpl.toLocaleString('vi-VN') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </article>
  );
}

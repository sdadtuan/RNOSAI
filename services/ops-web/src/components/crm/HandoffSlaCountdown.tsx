'use client';

import type { CSSProperties } from 'react';

export type HandoffSlaTone = 'ok' | 'warning' | 'breach' | 'na';

export type HandoffSlaClockView = {
  key: string;
  label: string;
  role?: string;
  due_at?: string | null;
  state: HandoffSlaTone;
  countdown: string;
  due_label: string;
  message?: string;
};

const TONE_LABEL: Record<HandoffSlaTone, string> = {
  ok: 'Đúng hạn',
  warning: 'Sắp trễ',
  breach: 'Trễ hạn',
  na: '—',
};

function toneOf(state?: string | null): HandoffSlaTone {
  if (state === 'warning' || state === 'breach' || state === 'ok') return state;
  return 'na';
}

export function HandoffSlaCountdown({
  clock,
  compact = false,
  className = '',
}: {
  clock: HandoffSlaClockView | null | undefined;
  compact?: boolean;
  className?: string;
}) {
  if (!clock || !clock.due_at) return null;
  const tone = toneOf(clock.state);
  if (tone === 'na') return null;
  const style = {
    '--sla-bg': tone === 'breach' ? '#fde8e8' : tone === 'warning' ? '#fff4d6' : '#e7f6ec',
    '--sla-fg': tone === 'breach' ? '#8a1f1f' : tone === 'warning' ? '#7a4e00' : '#146c2e',
    '--sla-bd': tone === 'breach' ? '#e7b0b0' : tone === 'warning' ? '#e6c56e' : '#9ad0ad',
  } as CSSProperties;

  if (compact) {
    return (
      <span
        className={`handoff-sla-chip handoff-sla-chip--${tone} ${className}`.trim()}
        style={style}
        title={`${clock.label}: ${clock.due_label}. ${clock.message ?? ''}`}
        data-testid={`handoff-sla-chip-${clock.key}`}
      >
        <strong>{TONE_LABEL[tone]}</strong>
        <span>
          {clock.countdown} · {clock.due_label}
        </span>
        <style>{`
          .handoff-sla-chip {
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
            padding: 0.15rem 0.45rem;
            border-radius: 999px;
            border: 1px solid var(--sla-bd);
            background: var(--sla-bg);
            color: var(--sla-fg);
            font-size: 0.75rem;
            line-height: 1.2;
            white-space: nowrap;
          }
          .handoff-sla-chip strong {
            font-weight: 700;
          }
        `}</style>
      </span>
    );
  }

  return (
    <div
      className={`handoff-sla-banner handoff-sla-banner--${tone} ${className}`.trim()}
      style={style}
      data-testid={`handoff-sla-banner-${clock.key}`}
    >
      <div className="handoff-sla-banner__row">
        <span className="handoff-sla-banner__tone">{TONE_LABEL[tone]}</span>
        <strong>{clock.label}</strong>
        {clock.role ? <span className="handoff-sla-banner__role">{clock.role}</span> : null}
      </div>
      <p className="handoff-sla-banner__count">
        {clock.countdown} · hạn {clock.due_label}
      </p>
      {clock.message ? <p className="handoff-sla-banner__msg">{clock.message}</p> : null}
      <style>{`
        .handoff-sla-banner {
          border: 1px solid var(--sla-bd);
          background: var(--sla-bg);
          color: var(--sla-fg);
          border-radius: 10px;
          padding: 0.55rem 0.75rem;
        }
        .handoff-sla-banner__row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem 0.6rem;
          align-items: baseline;
        }
        .handoff-sla-banner__tone {
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .handoff-sla-banner__role {
          font-size: 0.75rem;
          opacity: 0.8;
        }
        .handoff-sla-banner__count {
          margin: 0.2rem 0 0;
          font-size: 0.92rem;
          font-weight: 650;
        }
        .handoff-sla-banner__msg {
          margin: 0.15rem 0 0;
          font-size: 0.8rem;
          line-height: 1.35;
        }
      `}</style>
    </div>
  );
}

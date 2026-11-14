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
  className = '',
}: {
  clock: HandoffSlaClockView | null | undefined;
  /** Kept for callers; every stage now uses the same compact single-line style. */
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
  const due = clock.due_label ? ` (${clock.due_label})` : '';
  const label =
    clock.key === 'solution_accept'
      ? 'Hạn AM nhận / làm Solution'
      : clock.key === 'solution_work'
        ? 'Hạn AM làm Solution'
        : clock.label;

  return (
    <div
      className={`handoff-sla-banner handoff-sla-banner--line handoff-sla-banner--${tone} ${className}`.trim()}
      style={style}
      title={clock.message || undefined}
      data-testid={`handoff-sla-banner-${clock.key}`}
    >
      <span className="handoff-sla-banner__tone">{TONE_LABEL[tone]}</span>
      <span className="handoff-sla-banner__dot" aria-hidden="true">
        ·
      </span>
      <strong>{label}</strong>
      <span className="handoff-sla-banner__dot" aria-hidden="true">
        ·
      </span>
      <span className="handoff-sla-banner__count">
        {clock.countdown}
        {due}
      </span>
      <style>{`
        .handoff-sla-banner--line {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.2rem 0.4rem;
          border: 1px solid var(--sla-bd);
          background: var(--sla-bg);
          color: var(--sla-fg);
          border-radius: 8px;
          padding: 0.28rem 0.7rem;
          font-size: 0.82rem;
          line-height: 1.35;
          margin: 0 0 12px;
        }
        .handoff-sla-banner__tone {
          font-weight: 700;
        }
        .handoff-sla-banner__dot {
          opacity: 0.7;
        }
        .handoff-sla-banner__count {
          font-weight: 650;
        }
      `}</style>
    </div>
  );
}

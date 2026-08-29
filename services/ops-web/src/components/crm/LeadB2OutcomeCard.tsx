'use client';

import { useState } from 'react';
import {
  defaultNoteForB2Outcome,
  resolveB2CallOutcome,
  type B2CallOutcome,
  type B2OutcomePlan,
} from '@/lib/crm/lead-b2-outcome';

const CHIPS: Array<{ outcome: B2CallOutcome; label: string }> = [
  { outcome: 'talked', label: 'Đã nói chuyện' },
  { outcome: 'no_answer', label: 'Không nghe' },
  { outcome: 'wrong_number', label: 'Sai số / Lost' },
];

const DEFAULT_NOTES = CHIPS.map((c) => defaultNoteForB2Outcome(c.outcome));

type Props = {
  busy: boolean;
  retryCount?: number;
  lastNegativeLabel?: string | null;
  highlightAfterCall?: boolean;
  onSubmit: (plan: B2OutcomePlan) => Promise<void>;
  onError: (msg: string) => void;
};

export function LeadB2OutcomeCard({
  busy,
  retryCount = 0,
  lastNegativeLabel,
  highlightAfterCall = false,
  onSubmit,
  onError,
}: Props) {
  const [outcome, setOutcome] = useState<B2CallOutcome>('talked');
  const [note, setNote] = useState(defaultNoteForB2Outcome('talked'));
  const resolved = resolveB2CallOutcome({ outcome, note });
  const plan = resolved.ok ? resolved.plan : null;

  function pickOutcome(next: B2CallOutcome) {
    setOutcome(next);
    setNote((prev) => {
      if (!prev.trim() || DEFAULT_NOTES.includes(prev.trim())) {
        return defaultNoteForB2Outcome(next);
      }
      return prev;
    });
  }

  return (
    <div className="lead-b2-outcome" data-testid="lead-b2-outcome">
      <div className="lead-b2-outcome__chips" role="group" aria-label="Kết quả cuộc gọi">
        {CHIPS.map((chip) => (
          <button
            key={chip.outcome}
            type="button"
            className={`lead-b2-outcome__chip${outcome === chip.outcome ? ' is-active' : ''}`}
            disabled={busy}
            onClick={() => pickOutcome(chip.outcome)}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {highlightAfterCall ? (
        <p className="lead-b2-outcome__hint lead-b2-outcome__hint--after-call">
          Vừa gọi. Chọn kết quả rồi bấm Xong B2.
        </p>
      ) : null}

      <label className="lead-b2-outcome__note">
        Ghi chú
        <input
          type="text"
          value={note}
          disabled={busy}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      {plan?.kind === 'retry' ? (
        <p className="muted lead-b2-outcome__hint">Không mở Pre-sales. Ghi nhận để gọi lại.</p>
      ) : null}
      {plan?.kind === 'wrong_number' ? (
        <p className="lead-b2-outcome__hint lead-b2-outcome__hint--warn">
          Không mở Pre-sales. Cập nhật Trạng thái → lost nếu số không dùng được.
        </p>
      ) : null}
      {retryCount > 0 ? (
        <p className="muted lead-b2-outcome__hint">
          Đã ghi {retryCount} lần chưa nói chuyện
          {lastNegativeLabel ? ` · gần nhất: ${lastNegativeLabel}` : ''}.
        </p>
      ) : null}

      <button
        type="button"
        className="btn btn-primary btn-sm lead-b2-outcome__submit"
        disabled={busy || !plan}
        onClick={() => {
          const next = resolveB2CallOutcome({ outcome, note });
          if (!next.ok) {
            onError(next.error_vi);
            return;
          }
          void onSubmit(next.plan);
        }}
      >
        {plan?.primary_label_vi ?? 'Xong B2'}
      </button>
    </div>
  );
}

'use client';

import { useState } from 'react';
import {
  defaultNoteForB2Outcome,
  resolveB2CallOutcome,
  type B2OutcomePlan,
} from '@/lib/crm/lead-b2-outcome';

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
  const [note, setNote] = useState(defaultNoteForB2Outcome('talked'));
  const resolved = resolveB2CallOutcome({ outcome: 'talked', note });
  const plan = resolved.ok ? resolved.plan : null;

  return (
    <div className="lead-b2-outcome" data-testid="lead-b2-outcome">
      {highlightAfterCall ? (
        <p className="lead-b2-outcome__hint lead-b2-outcome__hint--after-call">
          Vừa gọi xong. Ghi chú rồi xác nhận để mở Pre-sales.
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

      {plan ? (
        <p className="muted lead-b2-outcome__hint">
          Xác nhận đã nói chuyện để hoàn thành B2 và mở Pre-sales. Không nghe máy hoặc sai số ghi ở
          bước phản hồi đầu, không dùng cổng này.
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
          const next = resolveB2CallOutcome({ outcome: 'talked', note });
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

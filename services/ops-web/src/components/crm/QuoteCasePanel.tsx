'use client';

import { useState } from 'react';
import {
  acceptLeadQuoteCase,
  approveLeadQuote,
  approveLeadSolution,
  requestLeadQuoteEdits,
  type LeadFunnelSnapshot,
} from '@/lib/api';

function when(value: string): string {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return '';
  return new Date(ms).toLocaleString('vi-VN');
}

export function QuoteCasePanel({
  token,
  leadId,
  funnel,
  onFunnelChange,
  onLeadReload,
  onMessage,
  onError,
}: {
  token: string;
  leadId: number;
  funnel: LeadFunnelSnapshot | null;
  onFunnelChange: (funnel: LeadFunnelSnapshot) => void;
  onLeadReload: () => Promise<void>;
  onMessage?: (message: string) => void;
  onError?: (message: string) => void;
}) {
  const quote = funnel?.presales?.quote_case;
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [localError, setLocalError] = useState('');

  if (!quote) return null;

  async function run(action: () => Promise<{ funnel: LeadFunnelSnapshot }>, done: string) {
    setBusy(true);
    setLocalError('');
    try {
      const out = await action();
      onFunnelChange(out.funnel);
      await onLeadReload();
      onMessage?.(done);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thực hiện được';
      setLocalError(message);
      onError?.(message);
    } finally {
      setBusy(false);
    }
  }

  const role = quote.expected_role ? `Bước của ${quote.expected_role}` : '';
  const acceptDue = when(quote.accept_due_at);
  const quoteDue = when(quote.quote_due_at);

  return (
    <section className="solution-desk" aria-label="Duyệt Solution và báo giá">
      <header className="solution-desk__head">
        <p className="solution-desk__kicker">{quote.step_label || 'Solution đã nộp'}</p>
        {role ? <p className="muted">{role}</p> : null}
      </header>
      {quote.ceo_escalation ? (
        <div className="lead-alert lead-alert--error" role="alert">
          {quote.ceo_escalation}
        </div>
      ) : null}
      {localError ? (
        <div className="lead-alert lead-alert--error" role="alert">
          {localError}
        </div>
      ) : null}
      {quote.phase === 'chuyen_bao_gia' && acceptDue ? (
        <p className="muted">Hạn nhận case: {acceptDue}. Quá hạn thì chuyển CEO.</p>
      ) : null}
      {quote.phase === 'bao_gia' && quoteDue ? (
        <p className="muted">Hạn xong báo giá: {quoteDue}. Quá hạn thì chuyển CEO.</p>
      ) : null}
      {quote.change_note ? (
        <p>
          <strong>Sale yêu cầu chỉnh:</strong> {quote.change_note}
        </p>
      ) : null}
      <div className="solution-desk__actions">
        {quote.phase === 'sale_approve_solution' ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() =>
              void run(
                () => approveLeadSolution(token, leadId),
                'Đã Approve Solution. Sang bước Chuyển Báo Giá.',
              )
            }
          >
            Approve
          </button>
        ) : null}
        {quote.phase === 'chuyen_bao_gia' ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() =>
              void run(() => acceptLeadQuoteCase(token, leadId), 'Đã nhận case lên báo giá.')
            }
          >
            Nhận Case Lên Báo Giá
          </button>
        ) : null}
        {quote.phase === 'sale_review' ? (
          <>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void run(() => approveLeadQuote(token, leadId), 'Đã Approve báo giá. Sang Triển Khai.')}
            >
              Approve
            </button>
            <label>
              Ghi chú chỉnh sửa
              <textarea
                rows={2}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                aria-label="Ghi chú chỉnh sửa báo giá"
              />
            </label>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy || note.trim().length < 5}
              onClick={() =>
                void run(
                  () => requestLeadQuoteEdits(token, leadId, note.trim()),
                  'Đã gửi yêu cầu chỉnh về Marketing Leader.',
                )
              }
            >
              Gửi lại Marketing Leader
            </button>
          </>
        ) : null}
        {quote.phase === 'trien_khai' ? <p>Báo giá đã Approve. Lead đang ở Triển Khai.</p> : null}
      </div>
    </section>
  );
}

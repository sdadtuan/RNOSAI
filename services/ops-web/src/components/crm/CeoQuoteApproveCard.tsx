'use client';

import { useRef, useState } from 'react';
import {
  approveLeadQuote,
  requestLeadQuoteEdits,
  type LeadFunnelSnapshot,
} from '@/lib/api';
import { ActionErrorToast } from '@/components/ui/ActionToast';

export function CeoQuoteApproveCard({
  token,
  leadId,
  canDecide,
  viewerIsSales = false,
  onFunnelChange,
  onLeadReload,
  onMessage,
  onError,
}: {
  token: string;
  leadId: number;
  canDecide: boolean;
  viewerIsSales?: boolean;
  onFunnelChange: (funnel: LeadFunnelSnapshot) => void;
  onLeadReload?: () => Promise<void> | void;
  onMessage?: (message: string) => void;
  onError?: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [reviseOpen, setReviseOpen] = useState(false);
  const [localError, setLocalError] = useState('');
  const runLockRef = useRef(false);

  async function run(action: () => Promise<{ funnel: LeadFunnelSnapshot }>, done: string) {
    if (runLockRef.current || busy) return;
    runLockRef.current = true;
    setBusy(true);
    setLocalError('');
    try {
      const out = await action();
      onFunnelChange(out.funnel);
      await onLeadReload?.();
      onMessage?.(done);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thực hiện được';
      setLocalError(message);
      onError?.(message);
    } finally {
      runLockRef.current = false;
      setBusy(false);
    }
  }

  return (
    <section
      id="quote-case"
      className="solution-feedback quote-sheet__ceo-decide"
      aria-label="Duyệt báo giá"
      data-testid="quote-ceo-review"
    >
      <h3 className="solution-feedback__title">Duyệt báo giá</h3>
      <p className="solution-feedback__due">
        {viewerIsSales && !canDecide
          ? 'Báo giá đang chờ CEO duyệt. Sales chỉ xem và tải sau khi được duyệt.'
          : 'Báo giá đã nộp, đang chờ CEO duyệt.'}
      </p>
      <ActionErrorToast message={onError ? '' : localError} />
      {canDecide ? (
        <>
          <div className="solution-feedback__actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() =>
                void run(
                  () => approveLeadQuote(token, leadId),
                  'CEO đã duyệt báo giá. AM lập hợp đồng; Sales chỉ xem và tải.',
                )
              }
            >
              Duyệt
            </button>
            {!reviseOpen ? (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => setReviseOpen(true)}
              >
                Trả lại AM
              </button>
            ) : null}
          </div>
          {reviseOpen ? (
            <div className="solution-feedback__revise">
              <label>
                Lý do từ chối
                <textarea
                  rows={3}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  aria-label="Lý do trả lại báo giá"
                  placeholder="Bắt buộc khi trả lại cho AM"
                />
              </label>
              <div className="solution-feedback__actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || note.trim().length < 5}
                  onClick={() =>
                    void run(
                      () => requestLeadQuoteEdits(token, leadId, note.trim()),
                      'Đã trả lại AM kèm lý do. Hạn nộp lại là 2 giờ làm việc.',
                    )
                  }
                >
                  Trả lại AM
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={() => {
                    setReviseOpen(false);
                    setNote('');
                  }}
                >
                  Huỷ
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <p className="muted">Chờ CEO duyệt báo giá rồi mới lập hợp đồng.</p>
      )}
    </section>
  );
}

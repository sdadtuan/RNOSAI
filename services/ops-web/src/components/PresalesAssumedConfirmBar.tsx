'use client';

import { useState } from 'react';
import { postPresalesConfirmField, postPresalesReturnToAm } from '@/lib/api';

export type AssumedFieldMeta = {
  status?: string;
  text?: string;
  source?: string;
  confidence?: number;
} | null;

type Props = {
  token: string;
  lifecycleId: number;
  canEdit: boolean;
  needPain?: AssumedFieldMeta;
  icp?: AssumedFieldMeta;
  serviceStatus?: string;
  onDone?: () => void;
  compact?: boolean;
};

function isAssumedDraft(meta: AssumedFieldMeta | undefined): boolean {
  return String(meta?.status ?? '') === 'assumed_draft' && Boolean(String(meta?.text ?? '').trim());
}

/** P8 — Confirm Assumed / Khách xác nhận / Reject when fields are assumed_draft. */
export function PresalesAssumedConfirmBar({
  token,
  lifecycleId,
  canEdit,
  needPain,
  icp,
  serviceStatus,
  onDone,
  compact = false,
}: Props) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const showPain = isAssumedDraft(needPain);
  const showIcp = isAssumedDraft(icp);
  const showService = serviceStatus === 'recommended_draft';
  if (!showPain && !showIcp && !showService) return null;
  if (!canEdit) return null;

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setError('');
    setMessage('');
    try {
      await fn();
      setMessage(`${label} — OK`);
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${label} thất bại`);
    } finally {
      setBusy('');
    }
  }

  return (
    <div
      className="card"
      style={{
        padding: compact ? '0.65rem' : '0.85rem',
        display: 'grid',
        gap: '0.5rem',
        borderColor: 'var(--accent, #2a7)',
      }}
    >
      <strong style={{ fontSize: '0.9rem' }}>Assumed draft — cần AM Confirm</strong>
      <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
        Gates chỉ nhận validated|assumed_confirmed (không tính assumed_draft).
      </p>
      {showPain ? (
        <p style={{ margin: 0, fontSize: '0.85rem' }}>
          <strong>Pain:</strong> {String(needPain?.text ?? '').slice(0, 180)}
          {String(needPain?.text ?? '').length > 180 ? '…' : ''}
        </p>
      ) : null}
      {showIcp ? (
        <p style={{ margin: 0, fontSize: '0.85rem' }}>
          <strong>ICP / Đối tượng:</strong> {String(icp?.text ?? '').slice(0, 180)}
          {String(icp?.text ?? '').length > 180 ? '…' : ''}
        </p>
      ) : null}
      {showService ? (
        <p style={{ margin: 0, fontSize: '0.85rem' }}>
          <strong>Service:</strong> recommended_draft — Confirm để mở Consult.
        </p>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      {message ? <p style={{ color: 'var(--accent)', margin: 0 }}>{message}</p> : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
        {showPain ? (
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            disabled={Boolean(busy)}
            onClick={() =>
              void run('Confirm Pain', () =>
                postPresalesConfirmField(token, lifecycleId, {
                  field: 'need_pain',
                  action: 'confirm_assumed',
                }),
              )
            }
          >
            Confirm Assumed (Pain)
          </button>
        ) : null}
        {showIcp ? (
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            disabled={Boolean(busy)}
            onClick={() =>
              void run('Confirm ICP', () =>
                postPresalesConfirmField(token, lifecycleId, {
                  field: 'icp',
                  action: 'confirm_assumed',
                }),
              )
            }
          >
            Confirm Assumed (ICP)
          </button>
        ) : null}
        {showService ? (
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            disabled={Boolean(busy)}
            onClick={() =>
              void run('Confirm Service', () =>
                postPresalesConfirmField(token, lifecycleId, {
                  field: 'service',
                  action: 'confirm_assumed',
                }),
              )
            }
          >
            Confirm Service
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-sm"
          disabled={Boolean(busy)}
          onClick={() =>
            void run('Khách xác nhận', () =>
              postPresalesConfirmField(token, lifecycleId, {
                field: showPain ? 'need_pain' : 'icp',
                action: 'validate_customer',
              }),
            )
          }
        >
          Khách đã xác nhận
        </button>
        <button
          type="button"
          className="btn btn-sm"
          disabled={Boolean(busy)}
          onClick={() =>
            void run('Trả AM', () =>
              postPresalesReturnToAm(token, lifecycleId, {
                reason_codes: [
                  showPain ? 'pain_unconfirmed' : '',
                  showIcp ? 'icp_unconfirmed' : '',
                  showService ? 'service_unknown' : '',
                ].filter(Boolean),
              }),
            )
          }
        >
          Reject / trả AM
        </button>
      </div>
    </div>
  );
}

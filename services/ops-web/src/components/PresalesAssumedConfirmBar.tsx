'use client';

import { useState } from 'react';
import { postPresalesConfirmField, postPresalesReturnToAm } from '@/lib/api';
import { TMMT_PROF_LABELS } from '@/lib/tmmt-labels';

export type AssumedFieldMeta = {
  status?: string;
  text?: string;
  source?: string;
  confidence?: number;
  ai_draft?: boolean;
} | null;

type TmmtCoreKey =
  | 'market_context'
  | 'segmentation_icp'
  | 'personas_roles'
  | 'pains_desired_outcomes';

type Props = {
  token: string;
  lifecycleId: number;
  canEdit: boolean;
  /**
   * Confirm Assumed stays available even when intake session is completed
   * (scoring canEdit may be false). Defaults to canEdit.
   */
  canConfirmAssumed?: boolean;
  needPain?: AssumedFieldMeta;
  icp?: AssumedFieldMeta;
  serviceStatus?: string;
  /** P8.2b — TMMT core field meta (ai_tmmt_field_meta) needing Confirm Assumed. */
  tmmtCoreMeta?: Partial<Record<TmmtCoreKey, AssumedFieldMeta>>;
  tmmtCoreText?: Partial<Record<TmmtCoreKey, string>>;
  onDone?: () => void;
  compact?: boolean;
};

const TMMT_CORE_KEYS: TmmtCoreKey[] = [
  'market_context',
  'segmentation_icp',
  'personas_roles',
  'pains_desired_outcomes',
];

/** assumed_draft | assumed | ai_draft without gate-satisfying status. */
export function needsAssumedConfirm(
  meta: AssumedFieldMeta | undefined,
  textFallback?: string,
): boolean {
  const text = String(meta?.text ?? textFallback ?? '').trim();
  if (!text) return false;
  const status = String(meta?.status ?? '')
    .trim()
    .toLowerCase();
  if (status === 'assumed_confirmed' || status === 'validated') return false;
  if (status === 'assumed_draft' || status === 'assumed') return true;
  if (meta?.ai_draft === true) return true;
  // Meta present with empty/unknown status → treat as assumed draft (autofill path).
  if (meta && typeof meta === 'object' && !status) return true;
  return false;
}

/** P8 — Confirm Assumed / Khách xác nhận / Reject when fields are assumed_draft. */
export function PresalesAssumedConfirmBar({
  token,
  lifecycleId,
  canEdit,
  canConfirmAssumed,
  needPain,
  icp,
  serviceStatus,
  tmmtCoreMeta,
  tmmtCoreText,
  onDone,
  compact = false,
}: Props) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const allowConfirm = canConfirmAssumed ?? canEdit;
  const showPain = needsAssumedConfirm(needPain);
  const showIcp = needsAssumedConfirm(icp);
  const showService = serviceStatus === 'recommended_draft';
  const tmmtNeeds = TMMT_CORE_KEYS.filter((key) =>
    needsAssumedConfirm(tmmtCoreMeta?.[key], tmmtCoreText?.[key]),
  );
  if (!showPain && !showIcp && !showService && tmmtNeeds.length === 0) return null;
  if (!allowConfirm) return null;

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
        Gates chỉ nhận validated|assumed_confirmed (không tính assumed / assumed_draft).
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
      {tmmtNeeds.map((key) => {
        const text = String(tmmtCoreMeta?.[key]?.text ?? tmmtCoreText?.[key] ?? '').trim();
        return (
          <p key={key} style={{ margin: 0, fontSize: '0.85rem' }}>
            <strong>TMMT · {TMMT_PROF_LABELS[key] ?? key}:</strong> {text.slice(0, 160)}
            {text.length > 160 ? '…' : ''}
          </p>
        );
      })}
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
        {tmmtNeeds.map((key) => (
          <button
            key={`confirm-${key}`}
            type="button"
            className="btn btn-sm btn-secondary"
            disabled={Boolean(busy)}
            onClick={() =>
              void run(`Confirm ${TMMT_PROF_LABELS[key] ?? key}`, () =>
                postPresalesConfirmField(token, lifecycleId, {
                  field: key,
                  action: 'confirm_assumed',
                }),
              )
            }
          >
            Confirm Assumed ({TMMT_PROF_LABELS[key] ?? key})
          </button>
        ))}
        <button
          type="button"
          className="btn btn-sm"
          disabled={Boolean(busy)}
          onClick={() =>
            void run('Khách xác nhận', () =>
              postPresalesConfirmField(token, lifecycleId, {
                field: showPain
                  ? 'need_pain'
                  : showIcp
                    ? 'icp'
                    : tmmtNeeds[0] ?? 'need_pain',
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
                  ...tmmtNeeds.map((k) => `tmmt_${k}_unconfirmed`),
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

'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getAccessToken, getStoredUser, hasCap } from '@/lib/auth';
import {
  getQtApprovals,
  postQtApprovalAction,
  type QtApprovalInboxItem,
  type QtApprovalInboxResult,
} from '@/lib/crm/qt-api';
import { dash } from '@/lib/crm/qt-format';
import { formatQtGm, formatQtVnd } from './QtStickyCommercial';

export const QT_LOST_REASONS = ['budget', 'competitor', 'priority', 'scope', 'other'] as const;

export type QtLostReason = (typeof QT_LOST_REASONS)[number];

const LOST_REASON_LABEL: Record<QtLostReason, string> = {
  budget: 'Ngân sách không phù hợp',
  competitor: 'Chọn đối thủ',
  priority: 'Đổi ưu tiên nội bộ',
  scope: 'Scope / timeline',
  other: 'Khác',
};

export const QT_APPROVAL_CHIPS = [
  { id: 'mine', label: 'Chờ tôi' },
  { id: 'done', label: 'Đã xử lý' },
  { id: 'sla', label: 'SLA vỡ' },
] as const;

export type QtApprovalChipId = (typeof QT_APPROVAL_CHIPS)[number]['id'];

export type QtApprovalRow = {
  quote_code?: string | null;
  trigger?: string | null;
  step?: string | null;
  sla?: string | null;
  owner?: string | { staff_id: number | null; name: string | null } | null;
};

export type { QtApprovalInboxItem };

const STEP_STATE_LABEL: Record<string, string> = {
  done: 'xong',
  waiting: 'chờ',
  locked: 'khóa',
  skipped: 'bỏ qua',
};

function asChip(value: string | null | undefined): QtApprovalChipId {
  if (value === 'done' || value === 'sla' || value === 'mine') return value;
  return 'mine';
}

function asScope(value: string | null): 'me' | 'team' | 'all' {
  if (value === 'team' || value === 'all') return value;
  return 'me';
}

function ownerName(owner: QtApprovalRow['owner']): string {
  if (owner && typeof owner === 'object') return dash(owner.name);
  return dash(owner);
}

export function actionNeedsComment(action: string): boolean {
  return action === 'return' || action === 'reject';
}

export function canSubmitStepAction(opts: {
  action: string;
  comment: string;
  canApprove: boolean;
  stepState: string;
  delegateStaffId?: number | null;
  lostReason?: string | null;
}): boolean {
  if (!opts.canApprove) return false;
  if (opts.stepState !== 'waiting') return false;
  if (actionNeedsComment(opts.action) && !String(opts.comment ?? '').trim()) return false;
  if (opts.action === 'reject' && !QT_LOST_REASONS.includes(opts.lostReason as QtLostReason)) {
    return false;
  }
  if (opts.action === 'delegate') {
    return Number(opts.delegateStaffId ?? 0) > 0;
  }
  return opts.action === 'approve' || opts.action === 'return' || opts.action === 'reject';
}

function snapshotValue(
  hasFinance: boolean,
  value: number | null | undefined,
  kind: 'vnd' | 'gm',
): string {
  if (!hasFinance) return dash(null);
  return kind === 'gm' ? formatQtGm(value) : formatQtVnd(value);
}

export function QtApprovalsInbox({
  items = [],
  chip = 'mine',
  onChip,
  onOpen,
}: {
  items?: Array<QtApprovalRow & Partial<QtApprovalInboxItem>>;
  chip?: QtApprovalChipId;
  onChip?: (id: QtApprovalChipId) => void;
  onOpen?: (item: QtApprovalRow & Partial<QtApprovalInboxItem>) => void;
}) {
  return (
    <div className="qt-approvals">
      <header className="qt-head">
        <div>
          <p className="qt-crumb">Kinh doanh / Báo giá / Phê duyệt</p>
          <h1>Hộp thư phê duyệt</h1>
          <p className="qt-muted">APR-01 · queue theo bước user được route</p>
        </div>
        <div className="qt-head__actions">
          <Link className="qt-btn" href="/crm/proposals/settings?tab=set-05">
            Policy
          </Link>
        </div>
      </header>
      <div className="qt-filters">
        {QT_APPROVAL_CHIPS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`qt-chip${chip === item.id ? ' qt-chip--on' : ''}`}
            onClick={onChip ? () => onChip(item.id) : undefined}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="qt-table-wrap">
        <table className="qt-table">
          <thead>
            <tr>
              <th>Quote</th>
              <th>Trigger</th>
              <th>Bước</th>
              <th>SLA</th>
              <th>Owner</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.length ? (
              items.map((row, index) => (
                <tr key={`${row.step_id ?? row.quote_code ?? 'row'}-${index}`}>
                  <td>{dash(row.quote_code)}</td>
                  <td>{dash(row.trigger)}</td>
                  <td>{dash(row.step)}</td>
                  <td>{dash(row.sla)}</td>
                  <td>{ownerName(row.owner)}</td>
                  <td>
                    <button type="button" className="qt-btn" onClick={onOpen ? () => onOpen(row) : undefined}>
                      Mở
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="qt-empty" colSpan={6}>
                  {dash(null)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function QtApprovalDetail({
  item,
  hasFinance,
  canApprove,
  comment,
  onComment,
  lostReason = '',
  onLostReason,
  onAction,
  onBack,
  delegateStaffId,
  onDelegateStaffId,
  until,
  onUntil,
}: {
  item: QtApprovalInboxItem;
  hasFinance: boolean;
  canApprove: boolean;
  comment: string;
  onComment?: (value: string) => void;
  lostReason?: string;
  onLostReason?: (value: string) => void;
  onAction?: (action: 'approve' | 'return' | 'reject' | 'delegate') => void;
  onBack?: () => void;
  delegateStaffId?: string;
  onDelegateStaffId?: (value: string) => void;
  until?: string;
  onUntil?: (value: string) => void;
}) {
  const steps = item.steps?.length
    ? item.steps
    : [{ id: item.step_id, approval_id: item.approval_id, seq: 1, section: item.step ?? '', state: item.state }];
  const title = [item.quote_code, item.version_n != null ? `v${item.version_n}` : null, item.client_name]
    .filter(Boolean)
    .join(' · ');
  const approveOk = canSubmitStepAction({
    action: 'approve',
    comment,
    canApprove,
    stepState: item.state,
  });
  const returnOk = canSubmitStepAction({
    action: 'return',
    comment,
    canApprove,
    stepState: item.state,
  });
  const rejectOk = canSubmitStepAction({
    action: 'reject',
    comment,
    lostReason,
    canApprove,
    stepState: item.state,
  });
  const delegateOk = canSubmitStepAction({
    action: 'delegate',
    comment,
    canApprove,
    stepState: item.state,
    delegateStaffId: Number(delegateStaffId || 0) || null,
  });

  return (
    <div className="qt-approvals">
      <header className="qt-head">
        <div>
          <p className="qt-crumb">Kinh doanh / Báo giá / Phê duyệt / {dash(item.quote_code)}</p>
          <h1>{title || 'Duyệt phiên bản'}</h1>
          <p className="qt-muted">APR-02 · step · policy · snapshot NSR · comment bắt buộc khi return</p>
        </div>
        <div className="qt-head__actions">
          {onBack ? (
            <button type="button" className="qt-btn" onClick={onBack}>
              Inbox
            </button>
          ) : null}
          <Link className="qt-btn" href="/crm/proposals/settings?tab=set-05">
            Policy
          </Link>
          <button
            type="button"
            className="qt-btn"
            disabled={!returnOk}
            onClick={onAction ? () => onAction('return') : undefined}
          >
            Trả lại
          </button>
          <button
            type="button"
            className="qt-btn"
            disabled={!rejectOk}
            onClick={onAction ? () => onAction('reject') : undefined}
          >
            Từ chối
          </button>
          <button
            type="button"
            className="qt-btn qt-btn--primary"
            disabled={!approveOk}
            onClick={onAction ? () => onAction('approve') : undefined}
          >
            Phê duyệt
          </button>
        </div>
      </header>

      <div className="qt-grid2">
        <div>
          <section className="qt-card">
            {steps.map((step, index) => (
              <div className="qt-apr-item" key={step.id || `${step.section}-${index}`}>
                <span className={`qt-apr-ico qt-apr-ico--${step.state === 'waiting' ? 'wait' : step.state === 'locked' ? 'lock' : step.state === 'skipped' ? 'skip' : 'done'}`}>
                  {step.state === 'done' ? '✓' : index + 1}
                </span>
                <div>
                  <h3>{dash(step.section)}</h3>
                  <p className="qt-muted">
                    {step.delegate_from != null ? `SET-05 · ủy quyền từ #${step.delegate_from}` : dash(step.comment)}
                  </p>
                </div>
                <span className={`qt-pill${step.state === 'done' ? ' qt-pill--ok' : step.state === 'waiting' ? ' qt-pill--warn' : ''}`}>
                  {STEP_STATE_LABEL[step.state] ?? step.state}
                </span>
              </div>
            ))}
          </section>
          <section className="qt-card qt-form">
            <label className="qt-form-label">
              Comment (bắt buộc nếu trả/từ chối)
              <textarea
                className="qt-inp"
                value={comment}
                onChange={onComment ? (event) => onComment(event.target.value) : undefined}
                readOnly={!onComment}
                placeholder="Lý do"
              />
            </label>
            <label className="qt-form-label">
              Lý do thua (lost_reason)
              <select
                className="qt-inp"
                aria-label="lost_reason"
                value={lostReason}
                onChange={onLostReason ? (event) => onLostReason(event.target.value) : undefined}
                disabled={!onLostReason}
              >
                <option value="">Chọn lý do</option>
                {QT_LOST_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {LOST_REASON_LABEL[reason]}
                  </option>
                ))}
              </select>
            </label>
            <label className="qt-form-label">
              <span>
                <input type="checkbox" checked={Boolean(delegateStaffId)} readOnly />
                {' '}
                Ủy quyền (delegate) — SET-05 · actor gốc + hạn + lý do
              </span>
            </label>
            <label className="qt-form-label">
              Staff ủy quyền
              <input
                className="qt-inp"
                value={delegateStaffId ?? ''}
                onChange={onDelegateStaffId ? (event) => onDelegateStaffId(event.target.value) : undefined}
                readOnly={!onDelegateStaffId}
              />
            </label>
            <label className="qt-form-label">
              Hạn
              <input
                className="qt-inp"
                value={until ?? ''}
                onChange={onUntil ? (event) => onUntil(event.target.value) : undefined}
                readOnly={!onUntil}
              />
            </label>
            <button
              type="button"
              className="qt-btn"
              disabled={!delegateOk}
              onClick={onAction ? () => onAction('delegate') : undefined}
            >
              Ủy quyền
            </button>
          </section>
        </div>
        <div>
          <section className="qt-card">
            <b>Policy kích hoạt</b>
            {(item.policy_badges ?? []).length ? (
              item.policy_badges.map((badge) => (
                <p key={badge.code}>
                  <span className={`qt-pill${badge.tone === 'ok' ? ' qt-pill--ok' : ' qt-pill--warn'}`}>
                    {badge.code}
                  </span>
                </p>
              ))
            ) : (
              <p className="qt-empty">{dash(null)}</p>
            )}
          </section>
          <section className="qt-card">
            <b>Commercial snapshot</b>
            <div className="qt-side-row">
              <span>NSR</span>
              <b>{snapshotValue(hasFinance, item.snapshot?.nsr_vnd, 'vnd')}</b>
            </div>
            <div className="qt-side-row">
              <span>Direct cost</span>
              <b>{snapshotValue(hasFinance, item.snapshot?.direct_cost_vnd, 'vnd')}</b>
            </div>
            <div className="qt-side-row">
              <span>GP</span>
              <b>{snapshotValue(hasFinance, item.snapshot?.gp_vnd, 'vnd')}</b>
            </div>
            <div className="qt-side-row">
              <span>GM</span>
              <b>{snapshotValue(hasFinance, item.snapshot?.gm_bps, 'gm')}</b>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export function QtApprovals() {
  const router = useRouter();
  const pathname = usePathname() ?? '/crm/proposals/approvals';
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const current = useMemo(() => new URLSearchParams(searchKey), [searchKey]);
  const chip = asChip(current.get('chip'));
  const scope = asScope(current.get('scope'));
  const selectedId = current.get('step');
  const [inbox, setInbox] = useState<QtApprovalInboxResult>({
    items: [],
    has_finance: false,
    can_approve: false,
  });
  const [comment, setComment] = useState('');
  const [lostReason, setLostReason] = useState('');
  const [delegateStaffId, setDelegateStaffId] = useState('');
  const [until, setUntil] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const user = getStoredUser();
  const hasFinance =
    inbox.has_finance || hasCap(user, 'crm_quote.finance', 'view');
  const canApprove =
    inbox.can_approve || hasCap(user, 'crm_quote.approve', 'execute');

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      setInbox(await getQtApprovals(token, { scope, chip }));
    } catch (caught) {
      setInbox({ items: [], has_finance: false, can_approve: false });
      setError(caught instanceof Error ? caught.message : 'Không tải được hộp thư phê duyệt');
    } finally {
      setLoading(false);
    }
  }, [scope, chip]);

  useEffect(() => {
    void load();
  }, [load]);

  function replaceParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(current);
    mutate(params);
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname);
  }

  const selected = inbox.items.find((row) => row.step_id === selectedId) ?? null;

  async function runAction(action: 'approve' | 'return' | 'reject' | 'delegate') {
    if (!selected) return;
    const token = getAccessToken();
    if (!token) return;
    if (
      !canSubmitStepAction({
        action,
        comment,
        lostReason,
        canApprove,
        stepState: selected.state,
        delegateStaffId: Number(delegateStaffId || 0) || null,
      })
    ) {
      return;
    }
    setError('');
    try {
      await postQtApprovalAction(token, selected.step_id, {
        action,
        comment: comment.trim() || null,
        lost_reason: action === 'reject' ? lostReason || null : undefined,
        delegate_staff_id: action === 'delegate' ? Number(delegateStaffId) : undefined,
        until: action === 'delegate' ? until || null : undefined,
      });
      setComment('');
      setLostReason('');
      setDelegateStaffId('');
      setUntil('');
      replaceParams((params) => params.delete('step'));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không gửi được bước duyệt');
    }
  }

  if (selected) {
    return (
      <>
        {error ? (
          <section className="qt-card qt-card--error">
            <p>{error}</p>
          </section>
        ) : null}
        <QtApprovalDetail
          item={selected}
          hasFinance={hasFinance}
          canApprove={canApprove}
          comment={comment}
          onComment={setComment}
          lostReason={lostReason}
          onLostReason={setLostReason}
          onAction={(action) => void runAction(action)}
          onBack={() => replaceParams((params) => params.delete('step'))}
          delegateStaffId={delegateStaffId}
          onDelegateStaffId={setDelegateStaffId}
          until={until}
          onUntil={setUntil}
        />
      </>
    );
  }

  return (
    <>
      {error ? (
        <section className="qt-card qt-card--error">
          <p>{error}</p>
          <button type="button" className="qt-btn" onClick={() => void load()}>
            Thử lại
          </button>
        </section>
      ) : null}
      <div aria-busy={loading}>
        <QtApprovalsInbox
          items={inbox.items}
          chip={chip}
          onChip={(next) =>
            replaceParams((params) => {
              if (next === 'mine') params.delete('chip');
              else params.set('chip', next);
              params.delete('step');
            })
          }
          onOpen={(row) =>
            replaceParams((params) => {
              if (row.step_id) params.set('step', row.step_id);
            })
          }
        />
      </div>
    </>
  );
}

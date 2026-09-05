'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import {
  escalateAmTask,
  fetchAmWorkItem,
  resolveAmTask,
  waitingClientAmTask,
  type AmWorkItemDetail,
} from '@/lib/crm/am-api';
import { formatAmWorkWhen } from '@/lib/crm/am-work-queue.util';
import {
  AM_WORK_ESCALATE_LEVELS,
  AM_WORK_KIND_COPY,
  AM_WORK_PRIORITY_COPY,
  AM_WORK_STATUS_COPY,
  amWorkItemBreached,
  amWorkItemClockCopy,
  amWorkItemErrorCopy,
  amWorkSuggestedLevel,
  type AmWorkEscalationLevel,
} from '@/lib/crm/am-work-item.util';
import { useAmPage } from './AmShell';

type ModalKind = 'wait' | 'resolve' | 'escalate' | null;

export function AmWorkItem({ taskId }: { taskId: string }) {
  const { token, canEdit } = useAmPage();
  const [data, setData] = useState<AmWorkItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState('');
  const [summary, setSummary] = useState('');
  const [category, setCategory] = useState('');
  const [level, setLevel] = useState<AmWorkEscalationLevel | ''>('');
  const [recipient, setRecipient] = useState('');
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    if (!token || !taskId) return;
    setLoading(true);
    setError('');
    try {
      const next = await fetchAmWorkItem(token, taskId);
      setData(next);
    } catch (err) {
      setData(null);
      setError(err instanceof ApiError && err.status === 404 ? 'not_found' : 'load_failed');
    } finally {
      setLoading(false);
    }
  }, [taskId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  function openModal(kind: ModalKind) {
    if (!data) return;
    setFormError('');
    setReason('');
    setEvidence('');
    setSummary('');
    setCategory('');
    setRecipient('');
    setLevel(amWorkSuggestedLevel(data));
    setModal(kind);
  }

  async function submitWait() {
    if (!token || !data || busy) return;
    setBusy(true);
    setFormError('');
    try {
      await waitingClientAmTask(token, data.id, {
        reason: reason.trim(),
        evidence: evidence.trim() || undefined,
      });
      setModal(null);
      await load();
    } catch (err) {
      const code = err instanceof ApiError ? err.message : 'reason_required';
      setFormError(amWorkItemErrorCopy(code));
    } finally {
      setBusy(false);
    }
  }

  async function submitResolve() {
    if (!token || !data || busy) return;
    setBusy(true);
    setFormError('');
    try {
      await resolveAmTask(token, data.id, {
        summary: summary.trim(),
        category: category.trim() || undefined,
      });
      setModal(null);
      await load();
    } catch (err) {
      const code = err instanceof ApiError ? err.message : 'summary_required';
      setFormError(amWorkItemErrorCopy(code));
    } finally {
      setBusy(false);
    }
  }

  async function submitEscalate() {
    if (!token || !data || busy) return;
    const recipientId = Number(recipient.trim());
    if (!level) {
      setFormError(amWorkItemErrorCopy('invalid_level'));
      return;
    }
    if (!Number.isInteger(recipientId) || recipientId <= 0) {
      setFormError(amWorkItemErrorCopy('invalid_recipient_staff_id'));
      return;
    }
    setBusy(true);
    setFormError('');
    try {
      await escalateAmTask(token, data.id, {
        level,
        recipient_staff_id: recipientId,
        summary: summary.trim(),
        reason: reason.trim() || undefined,
      });
      setModal(null);
      await load();
    } catch (err) {
      const code = err instanceof ApiError ? err.message : 'summary_required';
      setFormError(amWorkItemErrorCopy(code));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <section className="am-page">
        <p className="am-muted">Đang tải việc…</p>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="am-page">
        <p className="am-crumb">
          <Link href="/crm/account-management/work">Work Queue</Link>
        </p>
        <div className="am-widget__error">
          <p>
            {error === 'not_found'
              ? amWorkItemErrorCopy('not_found')
              : 'Không tải được việc. Thử lại.'}
          </p>
          <button type="button" className="am-btn" onClick={() => void load()}>
            Retry
          </button>
        </div>
      </section>
    );
  }

  const breached = amWorkItemBreached(data);
  const clock = amWorkItemClockCopy(data.sla_clock);
  const kindLabel = AM_WORK_KIND_COPY[data.kind] ?? data.kind;
  const priLabel = AM_WORK_PRIORITY_COPY[data.priority] ?? data.priority;
  const statusLabel = AM_WORK_STATUS_COPY[data.status] ?? data.status;

  return (
    <section className="am-page am-workitem">
      <p className="am-crumb">
        <Link href="/crm/account-management/work">Work Queue</Link>
        {' / '}
        {data.title || '—'}
      </p>

      {breached ? (
        <p className="am-banner" role="alert">
          Resolution SLA breached{clock ? ` ${clock}` : ''}
        </p>
      ) : null}

      <header className="am-360__head">
        <div>
          <h1>{data.title || '—'}</h1>
          <p className="am-muted">
            {data.account_name || '—'} · {kindLabel} · {priLabel}
          </p>
        </div>
        <span className={breached ? 'am-pill am-pill--crit' : 'am-pill'}>{statusLabel}</span>
      </header>

      <div className="am-split am-workitem__grid">
        <section className="am-widget">
          <h2>Nội dung</h2>
          <p>{data.title || '—'}</p>
          {data.waiting_client_reason ? (
            <p className="am-muted">Chờ khách: {data.waiting_client_reason}</p>
          ) : null}
          {data.resolution_summary ? (
            <p className="am-muted">
              Resolved: {data.resolution_summary}
              {data.resolution_category ? ` · ${data.resolution_category}` : ''}
            </p>
          ) : null}
        </section>
        <section className="am-widget">
          <h2>Thông tin xử lý</h2>
          <p>
            Status <b>{statusLabel}</b>
            <br />
            Assignee <b>{data.assignee_label || data.assignee_staff_id || '—'}</b>
            <br />
            First response <b>{formatAmWorkWhen(data.sla_first_due_at)}</b>
            <br />
            Resolution due <b>{formatAmWorkWhen(data.sla_resolve_due_at)}</b>
            <br />
            SLA {data.sla_paused ? <b>Paused</b> : <b>{clock || '—'}</b>}
          </p>
          {data.csd_href ? (
            <p>
              <Link className="am-link" href={data.csd_href}>
                Mở ticket CSD
              </Link>
            </p>
          ) : null}
          {data.escalation_level ? (
            <p className="am-muted">Escalation: {data.escalation_level}</p>
          ) : null}
        </section>
      </div>

      {canEdit ? (
        <div className="am-workitem__actions">
          <button type="button" className="am-btn" disabled={busy} onClick={() => openModal('wait')}>
            Chờ khách hàng
          </button>
          <button type="button" className="am-btn" disabled={busy} onClick={() => openModal('resolve')}>
            Resolved
          </button>
          <button
            type="button"
            className={breached ? 'am-btn am-btn--danger' : 'am-btn'}
            disabled={busy}
            onClick={() => openModal('escalate')}
          >
            Escalate
          </button>
        </div>
      ) : null}

      {modal ? (
        <div className="am-drawer-bg" role="presentation" onClick={() => setModal(null)}>
          <div
            className="am-onboard__modal"
            role="dialog"
            aria-labelledby="am-workitem-modal-title"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="am-widget__head">
              <h2 id="am-workitem-modal-title">
                {modal === 'wait' ? 'Chờ khách hàng' : modal === 'resolve' ? 'Resolved' : 'Escalate'}
              </h2>
              <button type="button" className="am-btn" onClick={() => setModal(null)}>
                ×
              </button>
            </div>

            {modal === 'wait' ? (
              <>
                <label className="am-field">
                  <span>Lý do *</span>
                  <textarea rows={3} value={reason} onChange={(ev) => setReason(ev.target.value)} />
                </label>
                <label className="am-field">
                  <span>Bằng chứng đã gửi</span>
                  <textarea rows={2} value={evidence} onChange={(ev) => setEvidence(ev.target.value)} />
                </label>
              </>
            ) : null}

            {modal === 'resolve' ? (
              <>
                <label className="am-field">
                  <span>Tóm tắt *</span>
                  <textarea rows={3} value={summary} onChange={(ev) => setSummary(ev.target.value)} />
                </label>
                {data.kind === 'issue' ? (
                  <label className="am-field">
                    <span>Category *</span>
                    <input value={category} onChange={(ev) => setCategory(ev.target.value)} />
                  </label>
                ) : (
                  <label className="am-field">
                    <span>Category</span>
                    <input value={category} onChange={(ev) => setCategory(ev.target.value)} />
                  </label>
                )}
              </>
            ) : null}

            {modal === 'escalate' ? (
              <>
                <fieldset className="am-field">
                  <legend>Cấp escalation *</legend>
                  {AM_WORK_ESCALATE_LEVELS.map((item) => (
                    <label key={item.value} className="am-field--check">
                      <span>
                        <input
                          type="radio"
                          name="am-escalate-level"
                          checked={level === item.value}
                          onChange={() => setLevel(item.value)}
                        />
                        {item.label}
                      </span>
                    </label>
                  ))}
                </fieldset>
                <label className="am-field">
                  <span>Người nhận (staff id) *</span>
                  <input
                    type="number"
                    min={1}
                    value={recipient}
                    onChange={(ev) => setRecipient(ev.target.value)}
                  />
                </label>
                <label className="am-field">
                  <span>Lý do</span>
                  <input value={reason} onChange={(ev) => setReason(ev.target.value)} />
                </label>
                <label className="am-field">
                  <span>Tóm tắt tình huống *</span>
                  <textarea rows={3} value={summary} onChange={(ev) => setSummary(ev.target.value)} />
                </label>
              </>
            ) : null}

            {formError ? <p className="am-banner">{formError}</p> : null}
            <div className="am-form__actions">
              <button type="button" className="am-btn" onClick={() => setModal(null)}>
                Hủy
              </button>
              <button
                type="button"
                className={modal === 'escalate' && breached ? 'am-btn am-btn--danger' : 'am-btn am-btn--primary'}
                disabled={busy}
                onClick={() => {
                  if (modal === 'wait') void submitWait();
                  else if (modal === 'resolve') void submitResolve();
                  else void submitEscalate();
                }}
              >
                {modal === 'wait' ? 'Đánh dấu chờ khách' : modal === 'resolve' ? 'Đánh dấu resolved' : 'Gửi escalation'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

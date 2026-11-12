'use client';

import { useEffect, useState } from 'react';
import {
  acceptLeadQuoteCase,
  approveLeadQuote,
  approveLeadSolution,
  downloadLeadContractDocx,
  fetchLeadFunnel,
  requestLeadQuoteEdits,
  requestLeadSolutionEdits,
  transferLeadQuoteCase,
  type LeadFunnelSnapshot,
} from '@/lib/api';

function when(value: string): string {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return '';
  return new Date(ms).toLocaleString('vi-VN');
}

function formatRemain(ms: number): string {
  const abs = Math.abs(ms);
  const totalSeconds = Math.floor(abs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const clock = [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
  return ms < 0 ? `Quá hạn ${clock}` : `Còn ${clock}`;
}

function QuoteDeadline({
  label,
  dueAt,
  overdue,
  soon,
}: {
  label: string;
  dueAt: string;
  overdue: boolean;
  soon?: boolean;
}) {
  const dueMs = Date.parse(dueAt);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!Number.isFinite(dueMs)) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [dueMs]);
  if (!label || !Number.isFinite(dueMs)) return null;
  const remain = dueMs - now;
  const late = overdue || remain < 0;
  const tone = late ? 'quote-case-timer quote-case-timer--late' : soon ? 'quote-case-timer quote-case-timer--soon' : 'quote-case-timer';
  return (
    <p className={tone} aria-live="polite">
      <span>{label}</span>
      <time dateTime={new Date(dueMs).toISOString()}>{when(dueAt)}</time>
      <strong>{formatRemain(remain)}</strong>
    </p>
  );
}

export function QuoteCasePanel({
  token,
  leadId,
  funnel,
  viewerIsCeo = false,
  viewerIsSales = false,
  onFunnelChange,
  onLeadReload,
  onMessage,
  onError,
}: {
  token: string;
  leadId: number;
  funnel: LeadFunnelSnapshot | null;
  viewerIsCeo?: boolean;
  viewerIsSales?: boolean;
  onFunnelChange: (funnel: LeadFunnelSnapshot) => void;
  onLeadReload: () => Promise<void>;
  onMessage?: (message: string) => void;
  onError?: (message: string) => void;
}) {
  const quote = funnel?.presales?.quote_case;
  const solution = funnel?.presales?.solution_case;
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [targetId, setTargetId] = useState('');
  const [localError, setLocalError] = useState('');
  const [customerAgreed, setCustomerAgreed] = useState(
    () => Boolean(funnel?.presales?.quote_case) && funnel?.presales?.quote_case?.phase !== 'sale_approve_solution',
  );
  const timerDue = quote?.timer_due_at ?? '';
  const timerStopped = Boolean(quote?.timer_stopped);

  useEffect(() => {
    if (quote?.phase && quote.phase !== 'sale_approve_solution') {
      setCustomerAgreed(true);
    }
    if (quote?.phase === 'sale_approve_solution') {
      setCustomerAgreed(false);
    }
  }, [quote?.phase]);

  useEffect(() => {
    if (!timerDue || timerStopped) return undefined;
    const at = Date.parse(timerDue);
    if (!Number.isFinite(at) || at <= Date.now()) return undefined;
    const id = window.setTimeout(() => {
      void fetchLeadFunnel(token, leadId)
        .then((next) => onFunnelChange(next))
        .catch(() => undefined);
    }, at - Date.now() + 400);
    return () => window.clearTimeout(id);
  }, [timerDue, timerStopped, token, leadId, onFunnelChange]);

  if (!quote) return null;

  async function run(action: () => Promise<{ funnel: LeadFunnelSnapshot }>, done: string) {
    setBusy(true);
    setLocalError('');
    try {
      const out = await action();
      onFunnelChange(out.funnel);
      await onLeadReload();
      onMessage?.(done);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thực hiện được';
      setLocalError(message);
      onError?.(message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const role = quote.expected_role ? `Bước của ${quote.expected_role}` : '';
  const assignee =
    quote.phase === 'chuyen_bao_gia' && quote.assignee_name
      ? `${quote.assignee_name} bấm Nhận Case Báo Giá trong 15 phút.`
      : '';

  return (
    <section id="quote-case" className="solution-desk" aria-label="Duyệt Solution và báo giá">
      <header className="solution-desk__head">
        <p className="solution-desk__kicker">{quote.step_label || 'Solution đã nộp'}</p>
        {role ? <p className="muted">{role}</p> : null}
      </header>
      {assignee ? <p>{assignee}</p> : null}
      {quote.timer_stopped && quote.phase !== 'hop_dong' ? (
        <p className="muted">
          {quote.phase === 'trien_khai'
            ? 'Đồng hồ báo giá đã dừng. Lead đang ở Triển Khai.'
            : quote.phase === 'ceo_review'
              ? 'Đồng hồ báo giá đã dừng. Đang chờ CEO duyệt.'
              : 'Đồng hồ báo giá đã dừng.'}
        </p>
      ) : quote.timer_stopped ? null : (
        <QuoteDeadline
          label={quote.timer_label}
          dueAt={quote.timer_due_at}
          overdue={quote.timer_overdue}
          soon={quote.timer_warning}
        />
      )}
      {quote.phase === 'sale_approve_solution' && solution?.phase === 'cho_phan_hoi' ? (
        <QuoteDeadline
          label={solution.timer_label}
          dueAt={solution.timer_due_at}
          overdue={solution.timer_overdue}
          soon={solution.timer_warning}
        />
      ) : null}
      {quote.reassign_note ? (
        <div className="lead-alert" role="status">
          {quote.reassign_note}
        </div>
      ) : null}
      {quote.warning_note && !quote.timer_overdue ? (
        <div className="lead-alert" role="status">
          {quote.warning_note}
        </div>
      ) : null}
      {solution?.phase === 'cho_phan_hoi' && solution.warning_note ? (
        <div className="lead-alert" role="status">
          {solution.warning_note}
        </div>
      ) : null}
      {solution?.phase === 'cho_phan_hoi' && solution.sla_note ? (
        <div className="lead-alert lead-alert--error" role="alert">
          {solution.sla_note}
        </div>
      ) : null}
      {quote.sla_note ? (
        <div className="lead-alert lead-alert--error" role="alert">
          {quote.sla_note}
        </div>
      ) : null}
      {viewerIsCeo && quote.ceo_escalation ? (
        <div className="lead-alert lead-alert--error" role="alert">
          Báo CEO: {quote.ceo_escalation.staff_name || 'Marketing Leader'} trễ {quote.ceo_escalation.timer_label}
          {quote.ceo_escalation.since ? ` từ ${when(quote.ceo_escalation.since)}` : ''}.
        </div>
      ) : null}
      {localError ? (
        <div className="lead-alert lead-alert--error" role="alert">
          {localError}
        </div>
      ) : null}
      {quote.change_note ? (
        <p>
          <strong>CEO từ chối:</strong> {quote.change_note}
        </p>
      ) : null}
      <div className="solution-desk__actions">
        {quote.phase === 'sale_approve_solution' && !customerAgreed ? (
          <>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => {
                setCustomerAgreed(true);
                void run(
                  () => approveLeadSolution(token, leadId),
                  'Khách đồng ý Solutions. Sang bước Chờ lập báo giá.',
                ).then((ok) => {
                  if (!ok) setCustomerAgreed(false);
                });
              }}
            >
              Khách đồng ý — Chờ báo giá
            </button>
            <label>
              Nội dung cần chỉnh
              <textarea
                rows={2}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                aria-label="Nội dung cần chỉnh Solutions"
                placeholder="Bắt buộc khi khách yêu cầu chỉnh"
              />
            </label>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy || note.trim().length < 5}
              onClick={() =>
                void run(
                  () => requestLeadSolutionEdits(token, leadId, note.trim()),
                  'Đã gửi yêu cầu chỉnh Solutions. Hạn trả lại là 2 giờ.',
                )
              }
            >
              Cần chỉnh sửa
            </button>
          </>
        ) : null}
        {quote.phase === 'chuyen_bao_gia' ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void run(() => acceptLeadQuoteCase(token, leadId), 'Đã nhận case báo giá. Hạn nộp là 2 giờ.')}
          >
            Nhận Case Báo Giá
          </button>
        ) : null}
        {quote.phase === 'ceo_review' || quote.phase === 'sale_review' ? (
          viewerIsCeo ? (
            <>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => approveLeadQuote(token, leadId),
                    'CEO đã duyệt báo giá. Sales có thể xem và tải.',
                  )
                }
              >
                Duyệt báo giá
              </button>
              <label>
                Lý do từ chối
                <textarea
                  rows={2}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  aria-label="Lý do từ chối báo giá"
                  placeholder="Bắt buộc khi từ chối, gửi lại cho AM"
                />
              </label>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy || note.trim().length < 5}
                onClick={() =>
                  void run(
                    () => requestLeadQuoteEdits(token, leadId, note.trim()),
                    'Đã từ chối và gửi lại AM kèm lý do. Hạn nộp lại là 2 giờ làm việc.',
                  )
                }
              >
                Từ chối, gửi lại AM
              </button>
            </>
          ) : (
            <p className="muted">
              {viewerIsSales
                ? 'Báo giá đang chờ CEO duyệt. Sales chỉ xem và tải sau khi được duyệt.'
                : 'Báo giá đã nộp, đang chờ CEO duyệt.'}
            </p>
          )
        ) : null}
        {quote.phase === 'hop_dong' ? (
          <>
            <p>CEO đã duyệt báo giá. Sales có thể xem và tải file hợp đồng (Word từ báo giá đã chốt). Gửi GĐKD duyệt trên tab Hợp đồng và Chốt, rồi lead mới sang Triển khai.</p>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                setLocalError('');
                void downloadLeadContractDocx(token, leadId)
                  .catch((err: unknown) => {
                    const message = err instanceof Error ? err.message : 'Không tải được file hợp đồng';
                    setLocalError(message);
                    onError?.(message);
                  })
                  .finally(() => setBusy(false));
              }}
            >
              Tải file hợp đồng
            </button>
          </>
        ) : null}
        {quote.phase === 'trien_khai' ? (
          <p>GĐKD đã duyệt hợp đồng. Lead đang ở Triển Khai.</p>
        ) : null}
        {viewerIsCeo && quote.expected_role && (quote.transfer_candidates?.length ?? 0) > 0 ? (
          <>
            <label>
              {`Giao ${quote.expected_role}`}
              <select
                aria-label={`Chọn ${quote.expected_role} nhận bước này`}
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
              >
                <option value="">{`Chọn ${quote.expected_role}`}</option>
                {(quote.transfer_candidates ?? []).map((person) => (
                  <option key={person.id} value={String(person.id)}>
                    {person.title ? `${person.name} · ${person.title}` : person.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy || !targetId}
              onClick={() =>
                void run(
                  () => transferLeadQuoteCase(token, leadId, Number(targetId)),
                  `Đã giao ${quote.expected_role}.`,
                )
              }
            >
              Giao người nhận
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}

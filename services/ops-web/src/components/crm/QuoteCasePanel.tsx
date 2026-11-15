'use client';

import { useEffect, useRef, useState } from 'react';
import {
  acceptLeadQuoteCase,
  approveLeadQuote,
  approveLeadSolution,
  createLeadContract,
  downloadLeadContractDocx,
  fetchLeadContract,
  fetchLeadFunnel,
  submitLeadContract,
  requestLeadQuoteEdits,
  requestLeadSolutionEdits,
  transferLeadQuoteCase,
  type LeadFunnelSnapshot,
} from '@/lib/api';
import { ActionErrorToast } from '@/components/ui/ActionToast';
import { shouldShowQuoteTransferBox } from '@/components/crm/quote-transfer-box.util';
import { LeadInternalNotes } from '@/components/crm/LeadInternalNotes';
import { formatCompactDueStamp, formatCompactSlaLine } from '@/lib/crm/sla-countdown-label';

function when(value: string): string {
  return formatCompactDueStamp(value);
}

function formatRemain(ms: number, dueAt: string, label: string): string {
  return formatCompactSlaLine(label, ms, dueAt);
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
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [dueMs]);
  if (!label || !Number.isFinite(dueMs)) return null;
  const remain = dueMs - now;
  const late = overdue || remain < 0;
  const tone = late
    ? 'quote-case-timer quote-case-timer--late handoff-sla-banner handoff-sla-banner--line handoff-sla-banner--breach'
    : soon
      ? 'quote-case-timer quote-case-timer--soon handoff-sla-banner handoff-sla-banner--line handoff-sla-banner--warning'
      : 'quote-case-timer handoff-sla-banner handoff-sla-banner--line handoff-sla-banner--ok';
  return (
    <p className={tone} aria-live="polite" data-testid="quote-case-deadline">
      {formatRemain(remain, dueAt, label)}
    </p>
  );
}

export function QuoteCasePanel({
  token,
  leadId,
  funnel,
  viewerIsCeo = false,
  viewerIsSuperAdmin = false,
  viewerIsSales = false,
  compact = false,
  onFunnelChange,
  onLeadReload,
  onMessage,
  onError,
}: {
  token: string;
  leadId: number;
  funnel: LeadFunnelSnapshot | null;
  viewerIsCeo?: boolean;
  viewerIsSuperAdmin?: boolean;
  viewerIsSales?: boolean;
  compact?: boolean;
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
  const [reviseOpen, setReviseOpen] = useState(false);
  const runLockRef = useRef(false);
  const timerDue = quote?.timer_due_at ?? '';
  const timerStopped = Boolean(quote?.timer_stopped);
  const quotePhase = quote?.phase ?? '';
  const [contractInfo, setContractInfo] = useState<{ id: number; status: string } | null>(null);
  const [approvalPending, setApprovalPending] = useState(false);

  useEffect(() => {
    if (quotePhase !== 'hop_dong' && quotePhase !== 'trien_khai') return undefined;
    let cancelled = false;
    void fetchLeadContract(token, leadId)
      .then((data) => {
        if (cancelled) return;
        setContractInfo(data.contract ? { id: data.contract.id, status: data.contract.status } : null);
        setApprovalPending(data.approval?.status === 'pending');
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [quotePhase, token, leadId]);

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
    if (runLockRef.current || busy) return false;
    runLockRef.current = true;
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
      runLockRef.current = false;
      setBusy(false);
    }
  }

  const canWriteContract = !viewerIsSales || viewerIsSuperAdmin;

  async function onCreateContract() {
    setBusy(true);
    setLocalError('');
    try {
      const row = await createLeadContract(token, leadId, {});
      setContractInfo({ id: row.id, status: row.status });
      onMessage?.('Đã tạo HĐ draft');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Tạo HĐ thất bại';
      setLocalError(message);
      onError?.(message);
    } finally {
      setBusy(false);
    }
  }

  async function onSubmitContract() {
    if (!contractInfo) return;
    setBusy(true);
    setLocalError('');
    try {
      await submitLeadContract(token, leadId, contractInfo.id, {});
      setApprovalPending(true);
      setContractInfo({ ...contractInfo, status: 'submitted' });
      onMessage?.('Đã gửi GDKD duyệt — chờ phê duyệt');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gửi GDKD duyệt thất bại';
      setLocalError(message);
      onError?.(message);
    } finally {
      setBusy(false);
    }
  }

  const role = quote.expected_role ? `Bước của ${quote.expected_role}` : '';
  const assignee =
    quote.phase === 'chuyen_bao_gia' && quote.assignee_name
      ? `${quote.assignee_name} bấm Nhận Case Báo Giá trong 15 phút.`
      : '';

  if (quote.phase === 'sale_approve_solution') {
    const dueLabel = solution?.timer_label || quote.timer_label || 'Hạn phản hồi khách';
    const dueAt = solution?.timer_due_at || quote.timer_due_at || '';
    const dueMs = Date.parse(dueAt);
    const remain = Number.isFinite(dueMs) ? dueMs - Date.now() : NaN;
    const dueLine = Number.isFinite(remain) ? formatRemain(remain, dueAt, dueLabel) : dueLabel;
    return (
      <section id="quote-case" className="solution-feedback" aria-label="Phản hồi Solution" data-testid="solution-feedback">
        <h3 className="solution-feedback__title">Phản hồi Solution</h3>
        {dueLine ? <p className="solution-feedback__due">{dueLine}</p> : null}
        {solution?.warning_note ? (
          <div className="lead-alert" role="status">{solution.warning_note}</div>
        ) : null}
        {solution?.sla_note ? (
          <div className="lead-alert lead-alert--error" role="alert">{solution.sla_note}</div>
        ) : null}
        {quote.warning_note && !quote.timer_overdue ? (
          <div className="lead-alert" role="status">{quote.warning_note}</div>
        ) : null}
        {quote.sla_note ? (
          <div className="lead-alert lead-alert--error" role="alert">{quote.sla_note}</div>
        ) : null}
        <ActionErrorToast message={onError ? '' : localError} />
        {!customerAgreed ? (
          <>
            <div className="solution-feedback__actions">
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
                Khách đồng ý — Chuyển báo giá
              </button>
              {!reviseOpen ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={() => setReviseOpen(true)}
                >
                  Cần chỉnh sửa
                </button>
              ) : null}
            </div>
            {reviseOpen ? (
              <div className="solution-feedback__revise">
                <label>
                  Nội dung cần chỉnh (bắt buộc)
                  <textarea
                    rows={5}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    aria-label="Nội dung cần chỉnh (bắt buộc)"
                    placeholder="Nhập nội dung khách cần chỉnh, ít nhất 5 ký tự"
                  />
                </label>
                <div className="solution-feedback__actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy || note.trim().length < 5}
                    onClick={() =>
                      void run(
                        () => requestLeadSolutionEdits(token, leadId, note.trim()),
                        'Đã gửi yêu cầu chỉnh Solutions. Hạn trả lại là 2 giờ.',
                      )
                    }
                  >
                    Gửi yêu cầu chỉnh sửa
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
          <p className="muted">Đã ghi nhận phản hồi Solution.</p>
        )}
      </section>
    );
  }


  const canCeoDecide = viewerIsCeo || viewerIsSuperAdmin;

  if (compact && (quote.phase === 'chuyen_bao_gia')) {
    return (
      <section id="quote-case" className="solution-feedback" aria-label="Nhận Case Báo Giá" data-testid="quote-accept-case">
        <h3 className="solution-feedback__title">Nhận Case Báo Giá</h3>
        {assignee ? <p className="solution-feedback__due">{assignee}</p> : null}
        <ActionErrorToast message={onError ? '' : localError} />
        <div className="solution-feedback__actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void run(() => acceptLeadQuoteCase(token, leadId), 'Đã nhận case báo giá. Hạn nộp là 2 giờ.')}
          >
            Nhận Case Báo Giá
          </button>
        </div>
      </section>
    );
  }

  if (compact && (quote.phase === 'ceo_review' || quote.phase === 'sale_review')) {
    return (
      <section id="quote-case" className="solution-feedback" aria-label="Duyệt báo giá" data-testid="quote-ceo-review">
        <h3 className="solution-feedback__title">Duyệt báo giá</h3>
        <p className="solution-feedback__due">
          {viewerIsSales && !canCeoDecide
            ? 'Báo giá đang chờ CEO duyệt. Sales chỉ xem và tải sau khi được duyệt.'
            : 'Báo giá đã nộp, đang chờ CEO duyệt.'}
        </p>
        <ActionErrorToast message={onError ? '' : localError} />
        {canCeoDecide ? (
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
                Duyệt báo giá
              </button>
              {!reviseOpen ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={() => setReviseOpen(true)}
                >
                  Từ chối, gửi lại AM
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
                    aria-label="Lý do từ chối báo giá"
                    placeholder="Bắt buộc khi từ chối, gửi lại cho AM"
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
                        'Đã từ chối và gửi lại AM kèm lý do. Hạn nộp lại là 2 giờ làm việc.',
                      )
                    }
                  >
                    Từ chối, gửi lại AM
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

  if (compact && quote.phase === 'hop_dong') {
    return (
      <section id="lead-contract" className="solution-feedback" aria-label="Lập hợp đồng" data-testid="quote-hop-dong">
        <h3 className="solution-feedback__title">Lập hợp đồng</h3>
        <p className="solution-feedback__due" data-testid="quote-hop-dong-copy">
          {viewerIsSales && !viewerIsSuperAdmin
            ? 'CEO đã duyệt báo giá. AM phụ trách (người lập báo giá) sẽ lập hợp đồng và gửi GĐKD duyệt. Sales có thể xem và tải file.'
            : 'CEO đã duyệt báo giá. AM lập hợp đồng và gửi GĐKD duyệt. Sales chỉ xem và tải.'}
        </p>
        {approvalPending ? <p className="muted">Đã gửi GDKD duyệt — chờ phê duyệt.</p> : null}
        <ActionErrorToast message={onError ? '' : localError} />
        <div className="solution-feedback__actions">
          {canWriteContract && !contractInfo ? (
            <button
              type="button"
              className="btn btn-primary"
              data-testid="quote-lap-hop-dong"
              disabled={busy}
              onClick={() => void onCreateContract()}
            >
              Lập hợp đồng
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-secondary"
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
          {canWriteContract && contractInfo && !approvalPending && contractInfo.status === 'draft' ? (
            <button
              type="button"
              className="btn btn-primary"
              id="lead-contract-submit"
              disabled={busy}
              onClick={() => void onSubmitContract()}
            >
              Gửi GDKD duyệt
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  if (compact) return null;

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
      <ActionErrorToast message={localError} />
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
          viewerIsCeo || viewerIsSuperAdmin ? (
            <>
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
            <p data-testid="quote-hop-dong-copy">
              {viewerIsSales && !viewerIsSuperAdmin
                ? 'CEO đã duyệt báo giá. AM phụ trách (người lập báo giá) sẽ lập hợp đồng và gửi GĐKD duyệt. Sales có thể xem và tải file.'
                : 'CEO đã duyệt báo giá. AM lập hợp đồng và gửi GĐKD duyệt. Sales chỉ xem và tải.'}
            </p>
            {approvalPending ? <p className="muted">Đã gửi GDKD duyệt — chờ phê duyệt.</p> : null}
            {canWriteContract && !contractInfo ? (
              <button
                type="button"
                className="btn btn-primary"
                data-testid="quote-lap-hop-dong"
                disabled={busy}
                onClick={() => void onCreateContract()}
              >
                Lập hợp đồng
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-secondary"
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
            {canWriteContract && contractInfo && !approvalPending && contractInfo.status === 'draft' ? (
              <button
                type="button"
                className="btn btn-primary"
                id="lead-contract-submit"
                disabled={busy}
                onClick={() => void onSubmitContract()}
              >
                Gửi GDKD duyệt
              </button>
            ) : null}
          </>
        ) : null}
        {quote.phase === 'trien_khai' ? (
          <p>GĐKD đã duyệt hợp đồng. Lead đang ở Triển Khai.</p>
        ) : null}
        {shouldShowQuoteTransferBox({
          viewerIsCeo,
          viewerIsSuperAdmin,
          expectedRole: quote.expected_role,
          candidateCount: quote.transfer_candidates?.length ?? 0,
          assigneeStaffId: quote.assignee_staff_id,
          phase: quote.phase,
        }) ? (
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
              title={busy ? 'Đang xử lý…' : !targetId ? 'Chọn người nhận trước khi giao.' : 'Giao case báo giá cho người được chọn.'}
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
      <LeadInternalNotes
        token={token}
        leadId={leadId}
        onMessage={onMessage}
        onError={onError}
        compact
        sectionTestId="qcp-notes"
        inputTestId="qcp-internal-input"
      />
    </section>
  );
}

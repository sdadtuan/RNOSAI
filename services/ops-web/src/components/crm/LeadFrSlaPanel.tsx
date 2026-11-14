'use client';


import { FormEvent, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  claimLeadSalesReceipt,
  fetchLeadFrSla,
  logLeadCallAttempt,
  type LeadFrSlaState,
} from '@/lib/api';
import { formatNewLeadOverdueLabel, resolveNewLeadClock, type NewLeadClock } from '@/lib/crm/new-lead-clock';
import { leadStatusAtOrAfterConsult } from '@/lib/crm/lead-status';
import {
  defaultTeamSlaDocument,
  type TeamSlaDocument,
} from '@/lib/crm/team-sla-profiles';
import { fetchTeamSlaDocument } from '@/lib/team-sla-api';
import { setLeadPageClaimed, setLeadPageClaimMinutes } from '@/lib/crm/lead-page-next-hint';

const CALL_RESULTS: { value: string; label: string; hint: string }[] = [
  {
    value: 'ring_no_answer',
    label: 'Không nghe máy',
    hint: 'Khách không bắt máy. Giữ lead để gọi lại trong hạn.',
  },
  {
    value: 'unreachable',
    label: 'Máy bận',
    hint: 'Thuê bao, máy bận lâu, hoặc không kết nối được.',
  },
  {
    value: 'wrong_number',
    label: 'Sai số',
    hint: 'Cần xác nhận đã kiểm tra trước khi đóng liên lạc.',
  },
  {
    value: 'connected_meet_pending',
    label: 'Đã nói chuyện — chờ gặp mặt (1a)',
    hint: 'Đã kết nối; nhập lịch gặp nếu có.',
  },
  {
    value: 'connected_qualified',
    label: 'Đã nói chuyện — đủ thông tin',
    hint: 'Thu thập đủ nhu cầu / đủ điều kiện tiếp tục pipeline.',
  },
  {
    value: 'callback_requested',
    label: 'Hẹn gọi lại',
    hint: 'Khách yêu cầu gọi lại; nhập thời điểm hẹn.',
  },
  {
    value: 'connected_other',
    label: 'Đã nói chuyện — kết quả khác',
    hint: 'Kết nối được nhưng không thuộc các trường hợp trên.',
  },
];

const CHANNELS: { value: string; label: string; countsFr1: boolean }[] = [
  { value: 'phone', label: 'Điện thoại (tính phản hồi đầu)', countsFr1: true },
  { value: 'zalo', label: 'Zalo (không tính phản hồi đầu)', countsFr1: false },
  { value: 'sms', label: 'SMS', countsFr1: false },
  { value: 'email', label: 'Email', countsFr1: false },
];

const CONTACT_VI: Record<string, string> = {
  new: 'Mới',
  attempting: 'Đang gọi',
  meet_pending: 'Chờ gặp',
  callback_scheduled: 'Đã hẹn gọi lại',
  connected: 'Đã liên lạc',
  unreachable_closed: 'Đóng — không liên lạc được',
  invalid_contact: 'Contact không hợp lệ',
  redistribute_queue: 'Chờ phân bổ lại',
};

const HOLD_REASON_VI: Record<string, string> = {
  '': '—',
  fr_chain_1b: 'Không nghe máy',
  fr_chain_1c: 'Máy bận',
  callback: 'Hẹn gọi lại',
  hot_lead: 'Lead nóng',
  redistribute: 'Chờ phân bổ lại',
  wrong_number: 'Sai số',
  manual_extend: 'Gia hạn thủ công',
};

const RESULT_VI: Record<string, string> = Object.fromEntries(
  CALL_RESULTS.map((r) => [r.value, r.label]),
);

function fmtRemain(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (ms <= 0) return 'Quá hạn';
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h <= 0) return `còn ${rm} phút`;
  return `còn ${h} giờ ${rm} phút`;
}

function fmtTs(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      timeZone: 'Asia/Saigon',
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour12: false,
    });
  } catch {
    return iso;
  }
}

function contactLabel(code: string | null | undefined): string {
  const key = String(code ?? '').trim().toLowerCase();
  if (!key) return '—';
  return CONTACT_VI[key] ?? code ?? '—';
}

function holdReasonLabel(code: string | null | undefined): string {
  const key = String(code ?? '').trim();
  if (!key) return '—';
  return HOLD_REASON_VI[key] ?? key;
}

function resultLabel(code: string | null | undefined): string {
  const key = String(code ?? '').trim();
  if (!key) return '—';
  return RESULT_VI[key] ?? key;
}

function clockBadge(clock: NewLeadClock | null): { tone: 'ok' | 'breach' | 'pending'; text: string } {
  if (!clock) return { tone: 'pending', text: '—' };
  if (clock.phase === 'done') return { tone: 'ok', text: 'Đã cập nhật' };
  if (clock.overdue) return { tone: 'breach', text: clock.phase === 'claim' ? 'Quá hạn nhận lead' : 'Quá hạn cập nhật' };
  return { tone: 'pending', text: fmtRemain(clock.remainingMs) };
}

export function LeadFrSlaPanel({
  token,
  leadId,
  canWrite = true,
  variant = 'full',
  status = null,
  b2Done = false,
  onClaimed,
}: {
  token: string;
  leadId: number;
  canWrite?: boolean;
  /** embedded = nằm trong bước B2, bỏ khung/tiêu đề trùng. */
  variant?: 'full' | 'embedded';
  /** CRM status. Receive-SLA controls hide once this is Tư vấn or later. */
  status?: string | null;
  /** First-contact (B2) already finished — stop the 15-minute / 1h clocks. */
  b2Done?: boolean;
  onClaimed?: (claimedAt: string | null) => void;
}) {
  const [sla, setSla] = useState<LeadFrSlaState | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [callResult, setCallResult] = useState('ring_no_answer');
  const [channel, setChannel] = useState('phone');
  const [notes, setNotes] = useState('');
  const [meetingAt, setMeetingAt] = useState('');
  const [callbackAt, setCallbackAt] = useState('');
  const [confirmWrong, setConfirmWrong] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [teamSla, setTeamSla] = useState<TeamSlaDocument | null>(null);
  const [claimedAt, setClaimedAt] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [historyKey, setHistoryKey] = useState(0);

  const reload = useCallback(async () => {
    try {
      const out = await fetchLeadFrSla(token, leadId);
      setSla(out);
      const at = out.sales_claimed_at ?? null;
      setClaimedAt(at);
      if (at) setLeadPageClaimed(true);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được SLA phản hồi đầu');
    }
  }, [token, leadId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (claimedAt) onClaimed?.(claimedAt);
  }, [claimedAt, onClaimed]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const body = await fetchTeamSlaDocument(token);
        if (!cancelled) {
          setTeamSla(body);
          const minutes = body.profiles.find((row) => row.code === 'sale_service')?.sale.claim_in_hours_minutes;
          setLeadPageClaimMinutes(minutes ?? 15);
        }
      } catch {
        if (!cancelled) setTeamSla(defaultTeamSlaDocument());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedResult = useMemo(
    () => CALL_RESULTS.find((r) => r.value === callResult) ?? CALL_RESULTS[0],
    [callResult],
  );


  const gapBlocked = Boolean(
    sla?.call_gap_blocked ||
      (sla?.next_call_allowed_at && now.getTime() < new Date(sla.next_call_allowed_at).getTime()),
  );
  const gapMessage = useMemo(() => {
    const nextIso = sla?.next_call_allowed_at;
    const lastIso = sla?.last_call_at;
    if (!nextIso || !lastIso) return sla?.call_gap_message ?? null;
    const next = new Date(nextIso);
    if (Number.isNaN(next.getTime()) || now.getTime() >= next.getTime()) return null;
    const last = new Date(lastIso);
    const elapsedMinutes = Number.isNaN(last.getTime())
      ? null
      : Math.max(0, Math.floor((now.getTime() - last.getTime()) / 60_000));
    const elapsedLabel =
      elapsedMinutes == null ? '' : elapsedMinutes < 1 ? 'dưới 1 phút' : `${elapsedMinutes} phút`;
    const when = next.toLocaleString('vi-VN', {
      timeZone: 'Asia/Saigon',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      day: now.toLocaleDateString('en-CA', { timeZone: 'Asia/Saigon' }) ===
        next.toLocaleDateString('en-CA', { timeZone: 'Asia/Saigon' })
        ? undefined
        : '2-digit',
      month:
        now.toLocaleDateString('en-CA', { timeZone: 'Asia/Saigon' }) ===
        next.toLocaleDateString('en-CA', { timeZone: 'Asia/Saigon' })
        ? undefined
        : '2-digit',
    });
    return `Cuộc gọi quá sát lần trước (cách ${elapsedLabel}) — chưa ghi. Gọi lại sau ${when}.`;
  }, [sla?.next_call_allowed_at, sla?.last_call_at, sla?.call_gap_message, now]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canWrite || inFlight.current || busy || gapBlocked) return;
    if (callResult === 'callback_requested' && !callbackAt) {
      setError('Cần chọn giờ hẹn gọi lại.');
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setMsg('');
    setError('');
    try {
      const out = await logLeadCallAttempt(token, leadId, {
        call_result: callResult,
        channel,
        notes: notes.trim() || undefined,
        meeting_at: meetingAt ? new Date(meetingAt).toISOString() : undefined,
        callback_at: callbackAt ? new Date(callbackAt).toISOString() : undefined,
        wrong_number_confirmed: callResult === 'wrong_number' ? confirmWrong : undefined,
      });
      setSla(out.sla);
      const bits: string[] = ['Đã ghi nhận cuộc gọi'];
      if (out.recompute.sla_frozen) bits.push('· SLA tạm đóng băng (giai đoạn ngoài phạm vi)');
      if (!out.recompute.counts_toward_fr1) bits.push('· lần này không tính phản hồi đầu');
      setMsg(bits.join(' '));
      setNotes('');
      setHistoryKey((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ghi nhận cuộc gọi thất bại');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const embedded = variant === 'embedded';
  const pastConsult = leadStatusAtOrAfterConsult(status);
  const clockCompleted = Boolean(b2Done || pastConsult);
  const leadClock = useMemo(
    () =>
      resolveNewLeadClock({
        document: teamSla,
        assignedAt: sla?.assigned_at,
        claimedAt,
        firstCallAt: sla?.first_call_at,
        completed: clockCompleted,
        now,
      }),
    [teamSla, sla?.assigned_at, sla?.first_call_at, claimedAt, clockCompleted, now],
  );
  const saleProfile = teamSla?.profiles.find((row) => row.code === 'sale_service');

  const onClaim = async () => {
    if (!canWrite) return;
    setBusy(true);
    setMsg('');
    setError('');
    try {
      const out = await claimLeadSalesReceipt(token, leadId);
      setSla(out);
      const at = out.sales_claimed_at ?? new Date().toISOString();
      setClaimedAt(at);
      setLeadPageClaimed(true);
      onClaimed?.(at);
      setNow(new Date());
      setMsg('Đã nhận lead. Đồng hồ cập nhật bắt đầu từ bây giờ.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không nhận được lead.');
    } finally {
      setBusy(false);
    }
  };

  if (!sla && !error) {
    return (
      <section
        className={`lead-fr-sla lead-fr-sla--loading${embedded ? ' lead-fr-sla--embedded' : ''}`}
        aria-busy="true"
      >
        <p className="muted">Đang tải hạn lead mới…</p>
      </section>
    );
  }

  const claimMinutes = saleProfile?.sale.claim_in_hours_minutes ?? 15;
  const updateHours = saleProfile?.sale.update_after_claim_hours ?? 1;
  const clockClosed = leadClock.phase === 'done' || clockCompleted;
  const clockLine = clockClosed
    ? leadClock.phase === 'done'
      ? leadClock.label
      : 'Đã xong'
    : leadClock.label;
  const lateLabel =
    !clockClosed && leadClock.overdue && leadClock.remainingMs != null
      ? formatNewLeadOverdueLabel(-leadClock.remainingMs)
      : null;
  const showClockBadge = clockClosed;
  const clockBadgeView = { tone: 'ok' as const, text: 'Đã xong' };
  const showClaimButton = leadClock.phase === 'claim' && canWrite && !clockCompleted;

  return (
    <section
      className={`lead-fr-sla${embedded ? ' lead-fr-sla--embedded' : ''}`}
      aria-label="Hạn lead mới"
    >
      <header className="lead-fr-sla__head">
        <div className="lead-fr-sla__titles">
          {embedded ? null : <h3>Hạn lead mới</h3>}
          <p
            className="lead-fr-sla__sub"
            data-testid="lead-fr-sla-clock"
            title={clockClosed ? undefined : leadClock.detail || undefined}
          >
            <span>{clockLine}</span>
            {lateLabel ? (
              <span className="lead-fr-sla__late" data-testid="lead-fr-sla-late">
                {lateLabel}
              </span>
            ) : null}
          </p>
        </div>
        <div className="lead-fr-sla__head-actions">
          <button
            type="button"
            className="lead-fr-sla__guide-btn"
            aria-expanded={guideOpen}
            onClick={() => setGuideOpen((v) => !v)}
          >
            {guideOpen ? 'Ẩn hướng dẫn' : 'Hướng dẫn SLA'}
          </button>
          {showClockBadge ? (
            <span className={`lead-fr-sla__badge lead-fr-sla__badge--${clockBadgeView.tone}`}>{clockBadgeView.text}</span>
          ) : null}
          {showClaimButton ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void onClaim()}
            >
              {busy ? 'Đang nhận…' : 'Nhận lead'}
            </button>
          ) : null}
        </div>
      </header>

      {guideOpen ? (
        <div className="lead-fr-sla__guide" role="note">
          <p>
            <strong>Lead mới</strong> có hai mốc. Trong ca (08:30–18:30 T2–T6), bấm{' '}
            <strong>Nhận lead</strong> trong <strong>{claimMinutes} phút</strong> kể từ lúc gán.
            Sau khi nhận, ghi cuộc gọi trong <strong>{updateHours} giờ làm việc</strong>.
          </p>
          <ul>
            <li>
              Ngoài ca hoặc cuối ngày (sau 18:30 / T7–CN), hạn nhận là 08:30 ngày làm việc kế tiếp. Bấm
              Nhận lead rồi đồng hồ 1 giờ làm việc cập nhật mới chạy.
            </li>
            <li>
              Ghi cuộc gọi điện thoại thì đóng hạn cập nhật. Zalo, SMS, email không đóng hạn này.
            </li>
            <li>
              <strong>Giữ đến:</strong> thời điểm hệ thống còn giữ lead cho AE hiện tại (sau đổ
              chuông / lead nóng). Chưa có nếu chưa ghi nhận cuộc gọi điện thoại.
            </li>
            <li>
              <strong>Lần gọi sau giao / Tổng đời lead:</strong> số lần gọi kể từ lần giao gần nhất
              / tổng số lần gọi trên lead.
            </li>
          </ul>
        </div>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
      {msg ? <p className="ok">{msg}</p> : null}

      {canWrite && !clockCompleted ? (
        <form className="lead-fr-sla__form" onSubmit={(e) => void onSubmit(e)}>
          <div className="lead-fr-sla__form-head">
            <h4>Ghi cuộc gọi — phản hồi đầu</h4>
            <p className="lead-fr-sla__hint">{selectedResult.hint}</p>
          </div>
          <label>
            Kết quả gọi
            <select value={callResult} onChange={(e) => setCallResult(e.target.value)} required>
              {CALL_RESULTS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Kênh liên lạc
            <select value={channel} onChange={(e) => setChannel(e.target.value)}>
              {CHANNELS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          {callResult === 'connected_meet_pending' ? (
            <label>
              Thời điểm gặp mặt
              <input
                type="datetime-local"
                value={meetingAt}
                onChange={(e) => setMeetingAt(e.target.value)}
              />
            </label>
          ) : null}
          {callResult === 'callback_requested' ? (
            <label>
              Thời điểm gọi lại
              <input
                type="datetime-local"
                value={callbackAt}
                onChange={(e) => setCallbackAt(e.target.value)}
              />
            </label>
          ) : null}
          {callResult === 'wrong_number' ? (
            <label className="lead-fr-sla__check">
              <input
                type="checkbox"
                checked={confirmWrong}
                onChange={(e) => setConfirmWrong(e.target.checked)}
              />
              Đã xác minh đây là số sai
            </label>
          ) : null}
          <label>
            Ghi chú
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tóm tắt nội dung cuộc gọi (không bắt buộc)"
            />
          </label>
          <button
            type="submit"
            className="btn btn-primary"
            data-testid="lead-fr-sla-submit"
            disabled={busy || gapBlocked || (callResult === 'callback_requested' && !callbackAt)}
          >
            {busy ? 'Đang lưu…' : 'Ghi cuộc gọi — phản hồi đầu'}
          </button>
          {gapBlocked && gapMessage ? (
            <p className="lead-fr-sla__gap" data-testid="lead-fr-sla-gap" role="status">
              {gapMessage}
            </p>
          ) : null}
        </form>
      ) : null}

      {sla ? (
        <div className="lead-fr-sla__metrics" role="list" data-testid="lead-fr-sla-metrics">
          <div
            role="listitem"
            className="lead-fr-sla__metric lead-fr-sla__metric--readonly"
            title="Thời điểm hệ thống còn giữ lead cho AE trước khi thu hồi / chuyển. Chỉ GĐKD được gia hạn."
          >
            <span className="lead-fr-sla__metric-label">Giữ đến</span>
            <strong>
              {sla.hold_until ? fmtTs(sla.hold_until) : 'Chưa có (chưa ghi nhận gọi ĐT)'}
            </strong>
          </div>
          <div role="listitem" className="lead-fr-sla__metric lead-fr-sla__metric--readonly" title="Trạng thái liên lạc hiện tại của lead">
            <span className="lead-fr-sla__metric-label">Trạng thái liên lạc</span>
            <strong>{contactLabel(sla.contact_status)}</strong>
          </div>
          <button
            type="button"
            role="listitem"
            className="lead-fr-sla__metric lead-fr-sla__metric--link"
            title="Xem lịch sử cuộc gọi"
            onClick={() => {
              if (typeof window === 'undefined') return;
              window.dispatchEvent(new CustomEvent('sld:open-call-history'));
            }}
          >
            <span className="lead-fr-sla__metric-label">Lần gọi</span>
            <strong>
              {sla.attempts_since_assign} sau giao · {sla.call_attempt_count} tổng
            </strong>
          </button>
          <button
            type="button"
            role="listitem"
            className="lead-fr-sla__metric lead-fr-sla__metric--link"
            title="Xem lịch sử cuộc gọi"
            onClick={() => {
              if (typeof window === 'undefined') return;
              window.dispatchEvent(new CustomEvent('sld:open-call-history'));
            }}
          >
            <span className="lead-fr-sla__metric-label">Kết quả gần nhất</span>
            <strong>{resultLabel(sla.last_call_result)}</strong>
          </button>
          <div role="listitem" className="lead-fr-sla__metric lead-fr-sla__metric--readonly" title="Lý do hệ thống đang giữ / gia hạn lead">
            <span className="lead-fr-sla__metric-label">Lý do giữ</span>
            <strong>{holdReasonLabel(sla.hold_reason)}</strong>
          </div>
        </div>
      ) : null}


      <style jsx>{`
        .lead-fr-sla {
          margin: 0.75rem 0 1rem;
          padding: 1rem 1.1rem 1.05rem;
          border: 1px solid rgba(23, 105, 47, 0.12);
          border-radius: 10px;
          background: linear-gradient(180deg, #f7faf8 0%, #ffffff 42%);
          box-shadow: 0 1px 0 rgba(15, 40, 25, 0.04);
        }
        .lead-fr-sla--embedded {
          margin: 0;
          padding: 0.85rem 0.9rem;
          box-shadow: none;
          background: #fff;
        }
        .lead-fr-sla__head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.85rem;
          margin-bottom: 0.75rem;
        }
        .lead-fr-sla__titles h3 {
          margin: 0;
          font-size: 1.05rem;
          font-weight: 650;
          color: #143528;
          letter-spacing: -0.01em;
        }
        .lead-fr-sla__sub {
          margin: 0.2rem 0 0;
          font-size: 0.82rem;
          color: #5b6b62;
          line-height: 1.35;
        }
        .lead-fr-sla__head-actions {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          flex-shrink: 0;
        }
        .lead-fr-sla__guide-btn {
          border: 1px solid rgba(23, 105, 47, 0.25);
          background: #fff;
          color: #17692f;
          font-size: 0.78rem;
          font-weight: 560;
          padding: 0.28rem 0.55rem;
          border-radius: 6px;
          cursor: pointer;
        }
        .lead-fr-sla__guide-btn:hover {
          background: #f0f7f2;
        }
        .lead-fr-sla__badge {
          font-size: 0.75rem;
          font-weight: 650;
          padding: 0.28rem 0.55rem;
          border-radius: 999px;
          white-space: nowrap;
        }
        .lead-fr-sla__badge--ok {
          background: #dcfce7;
          color: #166534;
        }
        .lead-fr-sla__badge--breach {
          background: #fee2e2;
          color: #991b1b;
        }
        .lead-fr-sla__badge--pending {
          background: #fef3c7;
          color: #92400e;
        }
        .lead-fr-sla__guide {
          margin: 0 0 0.85rem;
          padding: 0.7rem 0.85rem;
          border-radius: 8px;
          background: #eef6f0;
          border: 1px solid rgba(23, 105, 47, 0.14);
          font-size: 0.84rem;
          color: #254233;
          line-height: 1.45;
        }
        .lead-fr-sla__guide p {
          margin: 0 0 0.4rem;
        }
        .lead-fr-sla__guide ul {
          margin: 0;
          padding-left: 1.15rem;
        }
        .lead-fr-sla__guide li + li {
          margin-top: 0.25rem;
        }
        .lead-fr-sla__metrics {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 0.55rem 0.75rem;
          margin-bottom: 0.95rem;
          padding: 0.7rem 0.75rem;
          border-radius: 8px;
          background: #fff;
          border: 1px solid rgba(0, 0, 0, 0.06);
        }
        .lead-fr-sla__metrics > div,
        .lead-fr-sla__metrics > button {
          display: flex;
          flex-direction: column;
          gap: 0.18rem;
          min-width: 0;
          text-align: left;
          background: transparent;
          border: 0;
          padding: 0;
          color: inherit;
          font: inherit;
          box-shadow: none;
          cursor: default;
        }
        .lead-fr-sla__metric--readonly {
          pointer-events: none;
          cursor: default;
        }
        .lead-fr-sla__metric--link {
          pointer-events: auto;
          cursor: pointer;
          border-radius: 6px;
          padding: 0.1rem 0.15rem;
        }
        .lead-fr-sla__metric--link:hover,
        .lead-fr-sla__metric--link:focus-visible {
          outline: 2px solid rgba(23, 105, 47, 0.28);
          background: #f3f8f4;
        }
        .lead-fr-sla__metric-label {
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          color: #6b7a71;
        }
        .lead-fr-sla__metrics strong {
          font-size: 0.88rem;
          font-weight: 600;
          color: #1a2e24;
          line-height: 1.3;
          word-break: break-word;
        }
        .lead-fr-sla__form {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.6rem;
          padding-top: 0.15rem;
        }
        .lead-fr-sla__form-head {
          grid-column: 1 / -1;
          margin-bottom: 0.1rem;
        }
        .lead-fr-sla__form-head h4 {
          margin: 0;
          font-size: 0.92rem;
          color: #143528;
        }
        .lead-fr-sla__hint {
          margin: 0.2rem 0 0;
          font-size: 0.8rem;
          color: #5b6b62;
          line-height: 1.35;
        }
        .lead-fr-sla__form label {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          font-size: 0.8rem;
          font-weight: 560;
          color: #2d3d34;
        }
        .lead-fr-sla__form select,
        .lead-fr-sla__form input,
        .lead-fr-sla__form textarea {
          font: inherit;
          font-weight: 450;
          border: 1px solid rgba(0, 0, 0, 0.14);
          border-radius: 6px;
          padding: 0.4rem 0.5rem;
          background: #fff;
        }
        .lead-fr-sla__form select:focus,
        .lead-fr-sla__form input:focus,
        .lead-fr-sla__form textarea:focus {
          outline: 2px solid rgba(23, 105, 47, 0.28);
          border-color: #17692f;
        }
        .lead-fr-sla__form label:nth-child(n + 4) {
          grid-column: 1 / -1;
        }
        .lead-fr-sla__check {
          flex-direction: row !important;
          align-items: center;
          gap: 0.45rem !important;
          font-weight: 500 !important;
        }
        .lead-fr-sla__form .btn {
          grid-column: 1 / -1;
          justify-self: start;
          min-width: 11rem;
        }
        @media (max-width: 640px) {
          .lead-fr-sla__head {
            flex-direction: column;
          }
          .lead-fr-sla__form {
            grid-template-columns: 1fr;
          }
          .lead-fr-sla__form label:nth-child(n + 4) {
            grid-column: auto;
          }
        }
      `}</style>
    </section>
  );
}

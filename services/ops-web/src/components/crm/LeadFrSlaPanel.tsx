'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchLeadFrSla,
  logLeadCallAttempt,
  type LeadFrSlaState,
} from '@/lib/api';

const CALL_RESULTS: { value: string; label: string; hint: string }[] = [
  {
    value: 'ring_no_answer',
    label: 'Đổ chuông — khách không bắt (1b)',
    hint: 'Gia hạn giữ lead theo chuỗi FR; cần gọi lại trong thời hạn.',
  },
  {
    value: 'unreachable',
    label: 'Không liên lạc được (1c)',
    hint: 'Thuê bao, máy bận lâu, hoặc không kết nối được.',
  },
  {
    value: 'wrong_number',
    label: 'Sai số (1c)',
    hint: 'Cần xác nhận đã kiểm tra trước khi đóng contact.',
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
  fr_chain_1b: 'Chuỗi gọi lại sau đổ chuông',
  hot_lead: 'Lead nóng',
  redistribute: 'Chờ phân bổ lại',
  wrong_number: 'Sai số',
  manual_extend: 'GĐKD gia hạn thủ công',
};

const RESULT_VI: Record<string, string> = Object.fromEntries(
  CALL_RESULTS.map((r) => [r.value, r.label]),
);

const CHANNEL_VI: Record<string, string> = Object.fromEntries(
  CHANNELS.map((c) => [c.value, c.label.split(' (')[0]]),
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
    return new Date(iso).toLocaleString('vi-VN');
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

function channelLabel(code: string | null | undefined): string {
  const key = String(code ?? '').trim().toLowerCase();
  if (!key) return '—';
  return CHANNEL_VI[key] ?? code ?? '—';
}

function fr1Badge(sla: LeadFrSlaState | null): { tone: 'ok' | 'breach' | 'pending'; text: string } {
  if (!sla) return { tone: 'pending', text: '—' };
  if (sla.fr1_overdue) return { tone: 'breach', text: 'Quá hạn phản hồi đầu' };
  if (sla.first_call_at) return { tone: 'ok', text: 'Đã phản hồi đúng hạn' };
  return { tone: 'pending', text: fmtRemain(sla.fr1_remaining_ms) };
}

export function LeadFrSlaPanel({
  token,
  leadId,
  canWrite = true,
  variant = 'full',
}: {
  token: string;
  leadId: number;
  canWrite?: boolean;
  /** embedded = nằm trong bước B2, bỏ khung/tiêu đề trùng. */
  variant?: 'full' | 'embedded';
}) {
  const [sla, setSla] = useState<LeadFrSlaState | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [callResult, setCallResult] = useState('ring_no_answer');
  const [channel, setChannel] = useState('phone');
  const [notes, setNotes] = useState('');
  const [meetingAt, setMeetingAt] = useState('');
  const [callbackAt, setCallbackAt] = useState('');
  const [confirmWrong, setConfirmWrong] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const reload = useCallback(async () => {
    try {
      const out = await fetchLeadFrSla(token, leadId);
      setSla(out);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được SLA phản hồi đầu');
    }
  }, [token, leadId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const selectedResult = useMemo(
    () => CALL_RESULTS.find((r) => r.value === callResult) ?? CALL_RESULTS[0],
    [callResult],
  );

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
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
      if (out.recompute.warn_call_too_soon) bits.push('· khoảng cách giữa 2 lần gọi quá gần');
      if (out.recompute.sla_frozen) bits.push('· SLA tạm đóng băng (giai đoạn ngoài phạm vi)');
      if (!out.recompute.counts_toward_fr1) bits.push('· lần này không tính phản hồi đầu');
      setMsg(bits.join(' '));
      setNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ghi nhận cuộc gọi thất bại');
    } finally {
      setBusy(false);
    }
  };

  const embedded = variant === 'embedded';

  if (!sla && !error) {
    return (
      <section
        className={`lead-fr-sla lead-fr-sla--loading${embedded ? ' lead-fr-sla--embedded' : ''}`}
        aria-busy="true"
      >
        <p className="muted">Đang tải SLA phản hồi đầu…</p>
      </section>
    );
  }

  const badge = fr1Badge(sla);
  const fr1Hours = sla?.fr1_hours ?? 0;

  return (
    <section
      className={`lead-fr-sla${embedded ? ' lead-fr-sla--embedded' : ''}`}
      aria-label="SLA phản hồi đầu"
    >
      <header className="lead-fr-sla__head">
        <div className="lead-fr-sla__titles">
          {embedded ? null : <h3>SLA phản hồi đầu</h3>}
          {embedded ? null : (
            <p className="lead-fr-sla__sub">
              Theo dõi lần gọi điện thoại đầu tiên sau khi lead được giao.
            </p>
          )}
          {embedded ? (
            <p className="lead-fr-sla__sub">
              Đồng hồ phản hồi đầu · hạn mặc định {fr1Hours || '—'} giờ làm việc · chỉ kênh điện
              thoại.
            </p>
          ) : null}
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
          <span className={`lead-fr-sla__badge lead-fr-sla__badge--${badge.tone}`}>{badge.text}</span>
        </div>
      </header>

      {guideOpen ? (
        <div className="lead-fr-sla__guide" role="note">
          <p>
            <strong>Phản hồi đầu</strong> là lần <em>gọi điện thoại</em> đầu tiên sau khi AE nhận
            lead. Thời hạn mặc định: <strong>{fr1Hours || '—'} giờ làm việc</strong>.
          </p>
          <ul>
            <li>
              Chỉ kênh <strong>Điện thoại</strong> được tính vào phản hồi đầu. Zalo / SMS / email
              ghi nhận lịch sử nhưng không dừng đồng hồ phản hồi đầu.
            </li>
            <li>
              <strong>Hạn phản hồi:</strong> thời điểm phải hoàn thành lần gọi đầu.
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

      {sla ? (
        <div className="lead-fr-sla__metrics" role="list">
          <div role="listitem" title="Thời điểm phải hoàn thành lần gọi điện thoại đầu tiên">
            <span className="lead-fr-sla__metric-label">Hạn phản hồi đầu</span>
            <strong>{fmtTs(sla.fr1_due_at)}</strong>
          </div>
          <div
            role="listitem"
            title="Thời điểm hệ thống còn giữ lead cho AE trước khi thu hồi / chuyển"
          >
            <span className="lead-fr-sla__metric-label">Giữ đến</span>
            <strong>
              {sla.hold_until ? fmtTs(sla.hold_until) : 'Chưa có (chưa ghi nhận gọi ĐT)'}
            </strong>
          </div>
          <div role="listitem" title="Trạng thái liên lạc hiện tại của lead">
            <span className="lead-fr-sla__metric-label">Trạng thái liên lạc</span>
            <strong>{contactLabel(sla.contact_status)}</strong>
          </div>
          <div role="listitem" title="Số lần gọi sau giao / tổng số lần gọi trên lead">
            <span className="lead-fr-sla__metric-label">Lần gọi</span>
            <strong>
              {sla.attempts_since_assign} sau giao · {sla.call_attempt_count} tổng
            </strong>
          </div>
          <div role="listitem" title="Kết quả lần gọi gần nhất">
            <span className="lead-fr-sla__metric-label">Kết quả gần nhất</span>
            <strong>{resultLabel(sla.last_call_result)}</strong>
          </div>
          <div role="listitem" title="Lý do hệ thống đang giữ / gia hạn lead">
            <span className="lead-fr-sla__metric-label">Lý do giữ</span>
            <strong>{holdReasonLabel(sla.hold_reason)}</strong>
          </div>
        </div>
      ) : null}

      {canWrite ? (
        <form className="lead-fr-sla__form" onSubmit={(e) => void onSubmit(e)}>
          <div className="lead-fr-sla__form-head">
            <h4>Ghi nhận cuộc gọi</h4>
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
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Đang lưu…' : 'Ghi nhận cuộc gọi'}
          </button>
        </form>
      ) : null}

      {sla?.attempts?.length ? (
        <details className="lead-fr-sla__history">
          <summary>Lịch sử cuộc gọi ({sla.attempts.length})</summary>
          <ul>
            {sla.attempts.map((a) => (
              <li key={a.id}>
                <span className="lead-fr-sla__hist-no">#{a.attempt_no}</span>
                <span>{channelLabel(a.channel)}</span>
                <span>{resultLabel(a.call_result)}</span>
                <span className="muted">{fmtTs(a.started_at)}</span>
                {!a.counts_toward_fr1 ? (
                  <span className="lead-fr-sla__tag">Không tính phản hồi đầu</span>
                ) : null}
                {a.warn_call_too_soon ? (
                  <span className="lead-fr-sla__tag lead-fr-sla__tag--warn">Gọi quá sát</span>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
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
        .lead-fr-sla__metrics > div {
          display: flex;
          flex-direction: column;
          gap: 0.18rem;
          min-width: 0;
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
        .lead-fr-sla__history {
          margin-top: 0.9rem;
          font-size: 0.85rem;
          color: #2d3d34;
        }
        .lead-fr-sla__history summary {
          cursor: pointer;
          font-weight: 600;
          color: #17692f;
        }
        .lead-fr-sla__history ul {
          margin: 0.45rem 0 0;
          padding: 0;
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }
        .lead-fr-sla__history li {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.35rem 0.55rem;
          padding: 0.45rem 0.55rem;
          border-radius: 6px;
          background: #fff;
          border: 1px solid rgba(0, 0, 0, 0.06);
        }
        .lead-fr-sla__hist-no {
          font-weight: 650;
          color: #17692f;
          min-width: 1.6rem;
        }
        .lead-fr-sla__tag {
          font-size: 0.72rem;
          font-weight: 600;
          padding: 0.12rem 0.4rem;
          border-radius: 999px;
          background: #eef2f0;
          color: #3d5246;
        }
        .lead-fr-sla__tag--warn {
          background: #fef3c7;
          color: #92400e;
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

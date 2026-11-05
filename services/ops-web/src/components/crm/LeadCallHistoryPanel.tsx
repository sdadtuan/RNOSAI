'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchLeadFrSla, type LeadFrCallAttempt, type LeadFrSlaState } from '@/lib/api';

const RESULT_VI: Record<string, string> = {
  ring_no_answer: 'Không nghe máy',
  unreachable: 'Máy bận',
  wrong_number: 'Sai số',
  connected_meet_pending: 'Đã nói chuyện — chờ gặp mặt (1a)',
  connected_qualified: 'Đã nói chuyện — đủ thông tin',
  callback_requested: 'Hẹn gọi lại',
  connected_other: 'Đã nói chuyện — kết quả khác',
};

const CHANNEL_VI: Record<string, string> = {
  phone: 'Điện thoại',
  zalo: 'Zalo',
  sms: 'SMS',
  email: 'Email',
};

function fmtTs(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('vi-VN');
  } catch {
    return iso;
  }
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

function AttemptRow({ a }: { a: LeadFrCallAttempt }) {
  return (
    <li className="lead-call-history-item">
      <span className="lead-call-history-item__no">#{a.attempt_no}</span>
      <span>{channelLabel(a.channel)}</span>
      <span>{resultLabel(a.call_result)}</span>
      <time className="muted">{fmtTs(a.started_at)}</time>
      {!a.counts_toward_fr1 ? (
        <span className="lead-fr-sla__tag">Không tính phản hồi đầu</span>
      ) : null}
      {a.warn_call_too_soon ? (
        <span className="lead-fr-sla__tag lead-fr-sla__tag--warn">Gọi quá sát</span>
      ) : null}
    </li>
  );
}

export function LeadCallHistoryPanel({ token, leadId }: { token: string; leadId: number }) {
  const [sla, setSla] = useState<LeadFrSlaState | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const out = await fetchLeadFrSla(token, leadId);
      setSla(out);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được lịch sử cuộc gọi');
      setSla(null);
    } finally {
      setLoading(false);
    }
  }, [token, leadId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const attempts = sla?.attempts ?? [];

  return (
    <section className="lead-panel lead-panel--call-history" data-testid="lead-call-history">
      <div className="lead-panel__head">
        <h3 className="lead-panel__title">Lịch sử cuộc gọi</h3>
      </div>
      {loading ? <p className="lead-empty-state">Đang tải…</p> : null}
      {error ? <p className="lead-alert lead-alert--error">{error}</p> : null}
      {!loading && !error && attempts.length === 0 ? (
        <p className="lead-empty-state">Chưa có cuộc gọi được ghi nhận.</p>
      ) : null}
      {!loading && attempts.length > 0 ? (
        <ul className="lead-call-history-list">
          {attempts.map((a) => (
            <AttemptRow key={a.id} a={a} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

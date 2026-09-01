'use client';

import { useState } from 'react';
import { draftCsdTicketReply, type CsdCommentVisibility } from '@/lib/crm/csd-api';

type CsdTicketComposerProps = {
  token: string;
  ticketId: string;
  disabled?: boolean;
  onSubmit: (body: { visibility: CsdCommentVisibility; body_text: string }) => Promise<void>;
};

export function CsdTicketComposer({ token, ticketId, disabled, onSubmit }: CsdTicketComposerProps) {
  const [tab, setTab] = useState<CsdCommentVisibility>('public');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || disabled) return;
    setBusy(true);
    setMsg('');
    try {
      await onSubmit({ visibility: tab, body_text: body.trim() });
      setBody('');
      setMsg(tab === 'public' ? 'Đã gửi cho khách hàng' : 'Đã lưu ghi chú nội bộ');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Gửi thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleAiDraft() {
    setBusy(true);
    setMsg('');
    try {
      const out = await draftCsdTicketReply(token, ticketId);
      setBody(out.body_text);
      setMsg('Đã chèn bản nháp AI — hãy rà soát trước khi gửi');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Không tạo được bản nháp AI');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="csd-composer" data-testid="csd-ticket-composer">
      <div className="csd-composer__tabs segmented-control" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'public'}
          className={tab === 'public' ? 'is-active' : undefined}
          onClick={() => setTab('public')}
        >
          Gửi cho khách hàng
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'internal'}
          className={tab === 'internal' ? 'is-active' : undefined}
          onClick={() => setTab('internal')}
        >
          Ghi chú nội bộ
        </button>
      </div>
      <form onSubmit={(e) => void handleSubmit(e)} className="csd-composer__form">
        <textarea
          className="kpi-input csd-composer__textarea"
          rows={5}
          placeholder={
            tab === 'public'
              ? 'Phản hồi công khai cho khách hàng…'
              : 'Ghi chú chỉ nội bộ — không gửi SMTP…'
          }
          value={body}
          onChange={(e) => setBody(e.target.value)}
          data-testid="csd-composer-body"
        />
        <div className="csd-composer__actions">
          <button type="button" className="btn btn-sm btn-secondary" disabled={busy || disabled} onClick={() => void handleAiDraft()}>
            Bản nháp AI
          </button>
          <button type="submit" className="btn btn-sm" disabled={busy || disabled || !body.trim()}>
            {busy ? 'Đang gửi…' : tab === 'public' ? 'Gửi cho khách hàng' : 'Lưu ghi chú nội bộ'}
          </button>
        </div>
        {msg ? <p className="muted csd-composer__msg">{msg}</p> : null}
      </form>
    </div>
  );
}

'use client';

import { KeyboardEvent, useEffect, useState } from 'react';
import { CsdChatBubble } from '@/components/crm/csd/CsdChatBubble';
import {
  fetchCsdTickets,
  type CsdAttachmentRow,
  type CsdConversationMemberRow,
  type CsdConversationRow,
  type CsdMessageRow,
  type CsdTicketRow,
} from '@/lib/crm/csd-api';
import { avatarHue, formatDateChip, initialsFromName, shouldShowDateChip } from '@/lib/crm/csd-chat-display';

function mentionToken(draft: string): string | null {
  const match = draft.match(/(^|[\s])@(\d*)$/);
  return match ? match[2] : null;
}

function ticketToken(draft: string): string | null {
  const match = draft.match(/(^|[\s])#([A-Za-z0-9-]*)$/);
  return match ? match[2] : null;
}

type CsdChatThreadProps = {
  token: string;
  active: CsdConversationRow | null;
  messages: CsdMessageRow[];
  members: CsdConversationMemberRow[];
  relatedTickets: CsdTicketRow[];
  draft: string;
  replyTo: CsdMessageRow | null;
  pendingFiles: CsdAttachmentRow[];
  meStaffId: number | null;
  canWrite: boolean;
  busy: boolean;
  closed: boolean;
  priorityHint?: 'P1' | 'P2' | null;
  density?: 'page' | 'dock';
  showMobileBack?: boolean;
  onExpand?: () => void;
  onMinimize?: () => void;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onReply: (message: CsdMessageRow) => void;
  onCancelReply: () => void;
  onCreateTicket: (message: CsdMessageRow) => void;
  onReopen: () => void;
  onPickFile: (file: File) => void;
  onRemovePending: (fileId: string) => void;
  onEditMessage: (message: CsdMessageRow, bodyText: string) => void;
  onDeleteMessage: (message: CsdMessageRow) => void;
  onCopyLink: (message: CsdMessageRow) => void;
  onForward: (message: CsdMessageRow) => void;
  onMobileBack?: () => void;
  onShowContext?: () => void;
  onDismissPriorityHint?: () => void;
  onApplyPriorityHint?: () => void;
};

export function CsdChatThread({
  token,
  active,
  messages,
  members,
  relatedTickets,
  draft,
  replyTo,
  pendingFiles,
  meStaffId,
  canWrite,
  busy,
  closed,
  onDraftChange,
  onSend,
  onReply,
  onCancelReply,
  onCreateTicket,
  onReopen,
  onPickFile,
  onRemovePending,
  onEditMessage,
  onDeleteMessage,
  onCopyLink,
  onForward,
  onMobileBack,
  onShowContext,
  onExpand,
  onMinimize,
  onDismissPriorityHint,
  onApplyPriorityHint,
  priorityHint,
  density = 'page',
  showMobileBack,
}: CsdChatThreadProps) {
  const [ticketSuggest, setTicketSuggest] = useState<CsdTicketRow[]>([]);
  const mentionQ = mentionToken(draft);
  const hashQ = ticketToken(draft);
  const relatedById = new Map(relatedTickets.map((t) => [t.id, t]));

  useEffect(() => {
    if (hashQ == null) {
      setTicketSuggest([]);
      return;
    }
    const q = hashQ.trim();
    if (q.length < 1) {
      setTicketSuggest([]);
      return;
    }
    let cancelled = false;
    void fetchCsdTickets(token, { q, limit: '8' })
      .then((out) => {
        if (!cancelled) setTicketSuggest(out.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setTicketSuggest([]);
      });
    return () => {
      cancelled = true;
    };
  }, [hashQ, token]);

  const mentionOptions = members
    .map((m) => m.member_staff_id)
    .filter((id, index, all) => all.indexOf(id) === index)
    .filter((id) => mentionQ == null || String(id).startsWith(mentionQ));

  if (mentionQ && /^\d+$/.test(mentionQ)) {
    const typed = Number(mentionQ);
    if (typed > 0 && !mentionOptions.includes(typed)) mentionOptions.push(typed);
  }

  function insertAtToken(prefix: '@' | '#', value: string) {
    const next = draft.replace(prefix === '@' ? /(^|[\s])@\d*$/ : /(^|[\s])#[A-Za-z0-9-]*$/, `$1${prefix}${value} `);
    onDraftChange(next);
    setTicketSuggest([]);
  }

  function onDraftKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  if (!active) {
    return (
      <section className="csd-chat-workspace__thread">
        <div className="csd-chat-thread-empty">
          <p>Chọn hội thoại để xem tin nhắn</p>
        </div>
      </section>
    );
  }

  const isClient = active.kind === 'client';

  return (
    <section className="csd-chat-workspace__thread">
      <div className="csd-chat-thread-head">
        {showMobileBack ? (
          <button type="button" className="csd-chat-icon-btn" onClick={onMobileBack} data-testid="csd-chat-mobile-back">
            ←
          </button>
        ) : null}
        <span
          className="csd-chat-avatar csd-chat-avatar--thread"
          style={{ background: `hsl(${avatarHue(active.id)} 55% 42%)` }}
          aria-hidden
        >
          {initialsFromName(active.name_vi)}
        </span>
        <h3 className="csd-chat-thread-head__name">{active.name_vi}</h3>
        <div className="csd-chat-thread-head__actions">
          {onShowContext ? (
            <button
              type="button"
              className="csd-chat-icon-btn"
              data-testid="csd-chat-thread-info"
              aria-label="Thông tin hội thoại"
              onClick={onShowContext}
            >
              i
            </button>
          ) : null}
          {onExpand ? (
            <button type="button" className="csd-chat-icon-btn" onClick={onExpand}>
              Mở rộng
            </button>
          ) : null}
          {onMinimize ? (
            <button type="button" className="csd-chat-icon-btn" aria-label="Thu nhỏ" onClick={onMinimize}>
              —
            </button>
          ) : null}
        </div>
      </div>
      {priorityHint ? (
        <div className="csd-chat-priority-hint" data-testid="csd-chat-priority-hint">
          <span>Gợi ý tạo ticket {priorityHint}</span>
          <button type="button" className="btn btn-sm" onClick={onApplyPriorityHint}>
            Tạo ticket {priorityHint}
          </button>
          <button type="button" className="btn btn-sm btn-secondary" onClick={onDismissPriorityHint}>
            Bỏ qua
          </button>
        </div>
      ) : null}
      {isClient ? (
        <p className="csd-chat-client-banner" data-testid="csd-chat-client-banner">
          Bạn đang gửi cho khách hàng
        </p>
      ) : null}
      <ul className="csd-chat-messages" data-testid="csd-chat-messages">
        {messages.map((m, index) => {
          const quoted = m.reply_to_id ? messages.find((q) => q.id === m.reply_to_id) : null;
          const linked = m.ticket_id ? relatedById.get(m.ticket_id) : null;
          const pill = linked
            ? `${linked.code} · ${linked.priority} · ${linked.status}`
            : (m.ticket_code ?? 'Ticket liên kết');
          const isMine = meStaffId != null && m.author_staff_id === meStaffId;
          const prev = index > 0 ? messages[index - 1] : null;
          const showChip = shouldShowDateChip(prev?.created_at, m.created_at);
          return (
            <li key={m.id}>
              {showChip ? (
                <div className="csd-chat-date-chip" data-testid="csd-chat-date-chip">
                  {formatDateChip(m.created_at)}
                </div>
              ) : null}
              <CsdChatBubble
                token={token}
                message={m}
                isMine={isMine}
                quoted={quoted ?? null}
                ticketPill={m.ticket_id ? pill : null}
                ticketHref={m.ticket_id ? `/crm/csd/tickets/${m.ticket_id}` : null}
                closed={closed}
                canWrite={canWrite}
                busy={busy}
                density={density}
                showName={!isMine}
                allowCreateTicket={!m.ticket_id && active.kind !== 'announcement'}
                meStaffId={meStaffId}
                onReply={onReply}
                onCreateTicket={onCreateTicket}
                onEdit={onEditMessage}
                onDelete={onDeleteMessage}
                onCopyLink={onCopyLink}
                onForward={onForward}
              />
            </li>
          );
        })}
      </ul>
      {closed ? (
        <div className="csd-chat-closed">
          <p className="muted">Hội thoại đã đóng hoặc lưu trữ. Composer bị khóa.</p>
          {canWrite ? (
            <button type="button" className="btn btn-sm" disabled={busy} onClick={onReopen}>
              Mở lại
            </button>
          ) : null}
        </div>
      ) : canWrite ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSend();
          }}
          className="csd-chat-compose"
        >
          {replyTo ? (
            <div className="csd-chat-reply-bar">
              <span>Trả lời: {replyTo.body_text.slice(0, 80)}</span>
              <button type="button" className="csd-chat-icon-btn" onClick={onCancelReply}>
                Huỷ
              </button>
            </div>
          ) : null}
          {pendingFiles.length > 0 ? (
            <ul className="csd-chat-pending" data-testid="csd-chat-pending-files">
              {pendingFiles.map((file) => (
                <li key={file.id}>
                  <span className="csd-chat-file-chip">{file.file_name}</span>
                  <button type="button" className="csd-chat-icon-btn" onClick={() => onRemovePending(file.id)}>
                    Bỏ
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="csd-chat-compose__toolbar">
            <label className="csd-chat-icon-btn csd-chat-attach" title="Đính file">
              Đính file
              <input
                type="file"
                hidden
                data-testid="csd-chat-attach"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onPickFile(file);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
          <div className="csd-chat-compose__row">
            <div className="csd-chat-compose__field">
              <textarea
                rows={1}
                placeholder={`Nhập @, tin nhắn tới ${active.name_vi}`}
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                onKeyDown={onDraftKeyDown}
                data-testid="csd-chat-draft"
              />
              {mentionQ != null ? (
                <ul className="csd-chat-suggest" data-testid="csd-chat-mention-suggest">
                  {mentionOptions.length === 0 ? (
                    <li className="muted">Gõ staff id</li>
                  ) : (
                    mentionOptions.map((id) => (
                      <li key={id}>
                        <button type="button" onClick={() => insertAtToken('@', String(id))}>
                          @{id}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              ) : null}
              {hashQ != null && ticketSuggest.length > 0 ? (
                <ul className="csd-chat-suggest" data-testid="csd-chat-ticket-suggest">
                  {ticketSuggest.map((t) => (
                    <li key={t.id}>
                      <button type="button" onClick={() => insertAtToken('#', t.code)}>
                        #{t.code} · {t.priority} · {t.status}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <button
              type="submit"
              className="csd-chat-send"
              disabled={busy || (!draft.trim() && pendingFiles.length === 0)}
            >
              Gửi
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

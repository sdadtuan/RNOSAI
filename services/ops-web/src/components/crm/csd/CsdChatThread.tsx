'use client';

import { KeyboardEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  downloadCsdFile,
  fetchCsdTickets,
  formatCsdWhen,
  type CsdAttachmentRow,
  type CsdConversationMemberRow,
  type CsdConversationRow,
  type CsdMessageRow,
  type CsdTicketRow,
} from '@/lib/crm/csd-api';

const EDIT_WINDOW_MS = 15 * 60_000;

function canEditOwn(message: CsdMessageRow, meStaffId: number | null): boolean {
  if (!meStaffId || message.is_deleted || message.author_staff_id !== meStaffId) return false;
  const created = new Date(message.created_at).getTime();
  return Number.isFinite(created) && Date.now() - created <= EDIT_WINDOW_MS;
}

function canDeleteOwn(message: CsdMessageRow, meStaffId: number | null): boolean {
  return Boolean(meStaffId && !message.is_deleted && message.author_staff_id === meStaffId);
}

function renderMessageBody(text: string) {
  const parts = String(text).split(/(@\d+|#PTT-\d{4}-\d{6})/gi);
  return parts.map((part, index) =>
    /^@\d+$/.test(part) || /^#PTT-\d{4}-\d{6}$/i.test(part) ? (
      <strong key={`${part}-${index}`}>{part}</strong>
    ) : (
      part
    ),
  );
}

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
  showMobileBack?: boolean;
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
  onDismissPriorityHint,
  onApplyPriorityHint,
  priorityHint,
  showMobileBack,
}: CsdChatThreadProps) {
  const [ticketSuggest, setTicketSuggest] = useState<CsdTicketRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
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
      <section className="csd-chat-workspace__thread page-card">
        <p className="muted">Chọn hội thoại để xem tin nhắn</p>
      </section>
    );
  }

  const isClient = active.kind === 'client';

  return (
    <section className="csd-chat-workspace__thread page-card">
      <div className="csd-chat-thread-head">
        {showMobileBack ? (
          <button type="button" className="btn btn-sm btn-secondary" onClick={onMobileBack} data-testid="csd-chat-mobile-back">
            ← Hội thoại
          </button>
        ) : null}
        <h3 className="kpi-section-title">{active.name_vi}</h3>
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
        {messages.map((m) => {
          const quoted = m.reply_to_id ? messages.find((q) => q.id === m.reply_to_id) : null;
          const linked = m.ticket_id ? relatedById.get(m.ticket_id) : null;
          const pill = linked
            ? `${linked.code} · ${linked.priority} · ${linked.status}`
            : (m.ticket_code ?? 'Ticket liên kết');
          const editing = editingId === m.id;
          return (
            <li key={m.id} className={`csd-chat-message${m.is_deleted ? ' is-deleted' : ''}`}>
              <div className="csd-chat-message__meta muted">
                {m.author_staff_name ?? 'Khách'} · {formatCsdWhen(m.created_at)}
                {m.edited_at && !m.is_deleted ? ' · đã sửa' : ''}
              </div>
              {quoted ? (
                <p className="csd-chat-quote muted">
                  ↩ {quoted.is_deleted ? 'Đã xóa' : quoted.body_text.slice(0, 120)}
                </p>
              ) : null}
              {m.is_deleted ? (
                <p className="csd-chat-deleted" data-testid="csd-chat-deleted">
                  Đã xóa
                </p>
              ) : editing ? (
                <div className="csd-chat-edit">
                  <textarea
                    className="kpi-input"
                    rows={2}
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    data-testid="csd-chat-edit-draft"
                  />
                  <div className="csd-chat-message__actions">
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => {
                        setEditingId(null);
                        setEditDraft('');
                      }}
                    >
                      Huỷ
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={busy || !editDraft.trim()}
                      onClick={() => {
                        onEditMessage(m, editDraft.trim());
                        setEditingId(null);
                        setEditDraft('');
                      }}
                    >
                      Lưu
                    </button>
                  </div>
                </div>
              ) : (
                <p>{renderMessageBody(m.body_text)}</p>
              )}
              {!m.is_deleted && (m.attachments ?? []).length > 0 ? (
                <ul className="csd-chat-files">
                  {(m.attachments ?? []).map((file) => (
                    <li key={file.id}>
                      <button
                        type="button"
                        className="csd-chat-file-chip"
                        onClick={() => void downloadCsdFile(token, file.id, file.file_name)}
                      >
                        {file.file_name}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {m.ticket_id ? (
                <Link
                  href={`/crm/csd/tickets/${m.ticket_id}`}
                  className="csd-chat-ticket-pill"
                  data-testid="csd-chat-ticket-pill"
                >
                  {pill}
                </Link>
              ) : null}
              {canWrite && !closed && !m.is_deleted && !editing ? (
                <div className="csd-chat-message__actions">
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => onReply(m)}>
                    Trả lời
                  </button>
                  {!m.ticket_id && active.kind !== 'announcement' ? (
                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => onCreateTicket(m)}>
                      Tạo ticket
                    </button>
                  ) : null}
                  {canEditOwn(m, meStaffId) ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      data-testid="csd-chat-edit"
                      onClick={() => {
                        setEditingId(m.id);
                        setEditDraft(m.body_text);
                      }}
                    >
                      Sửa
                    </button>
                  ) : null}
                  {canDeleteOwn(m, meStaffId) ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      data-testid="csd-chat-delete"
                      onClick={() => onDeleteMessage(m)}
                    >
                      Xóa
                    </button>
                  ) : null}
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => onCopyLink(m)}>
                    Copy link
                  </button>
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => onForward(m)}>
                    Chuyển tiếp
                  </button>
                </div>
              ) : null}
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
              <button type="button" className="btn btn-sm btn-secondary" onClick={onCancelReply}>
                Huỷ
              </button>
            </div>
          ) : null}
          {pendingFiles.length > 0 ? (
            <ul className="csd-chat-pending" data-testid="csd-chat-pending-files">
              {pendingFiles.map((file) => (
                <li key={file.id}>
                  <span className="csd-chat-file-chip">{file.file_name}</span>
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => onRemovePending(file.id)}>
                    Bỏ
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="csd-chat-compose__field">
            <textarea
              className="kpi-input"
              rows={3}
              placeholder="Nhập tin nhắn… @staff · #ticket · đính file · Enter gửi"
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
          <div className="csd-chat-compose__actions">
            <label className="btn btn-sm btn-secondary csd-chat-attach">
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
            <button
              type="submit"
              className="btn btn-sm"
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

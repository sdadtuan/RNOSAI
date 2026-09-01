'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  createCsdConversation,
  createCsdTicketFromMessage,
  fetchCsdConversations,
  fetchCsdMessages,
  sendCsdMessage,
  formatCsdWhen,
  CSD_PRIORITY_LABELS,
  CSD_TICKET_TYPES,
  type CsdConversationRow,
  type CsdMessageRow,
  type CsdPriority,
} from '@/lib/crm/csd-api';

type CsdChatWorkspaceProps = {
  token: string;
  canWrite: boolean;
};

export function CsdChatWorkspace({ token, canWrite }: CsdChatWorkspaceProps) {
  const [conversations, setConversations] = useState<CsdConversationRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CsdMessageRow[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ticketModal, setTicketModal] = useState<CsdMessageRow | null>(null);
  const [ticketForm, setTicketForm] = useState({
    title: '',
    ticket_type: 'request',
    priority: 'P3' as CsdPriority,
  });

  const loadConversations = useCallback(async () => {
    try {
      const out = await fetchCsdConversations(token);
      setConversations(out.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải hội thoại thất bại');
    }
  }, [token]);

  const loadMessages = useCallback(
    async (conversationId: string) => {
      try {
        const out = await fetchCsdMessages(token, conversationId);
        setMessages(out.items ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải tin nhắn thất bại');
      }
    },
    [token],
  );

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!activeId) return;
    void loadMessages(activeId);
    const timer = window.setInterval(() => void loadMessages(activeId), 5000);
    return () => window.clearInterval(timer);
  }, [activeId, loadMessages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!activeId || !draft.trim() || !canWrite) return;
    setBusy(true);
    try {
      await sendCsdMessage(token, activeId, { body_text: draft.trim() });
      setDraft('');
      await loadMessages(activeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gửi tin nhắn thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleNewConversation() {
    if (!canWrite) return;
    setBusy(true);
    try {
      const row = await createCsdConversation(token, {
        kind: 'client',
        name_vi: `Hội thoại ${new Date().toLocaleString('vi-VN')}`,
        client_account_id: 'demo-client',
      });
      await loadConversations();
      setActiveId(row.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo hội thoại thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!ticketModal || !ticketForm.title.trim()) return;
    setBusy(true);
    try {
      const ticket = await createCsdTicketFromMessage(token, ticketModal.id, ticketForm);
      setTicketModal(null);
      setTicketForm({ title: '', ticket_type: 'request', priority: 'P3' });
      if (activeId) await loadMessages(activeId);
      window.open(`/crm/csd/tickets/${ticket.id}`, '_blank', 'noopener');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo ticket thất bại');
    } finally {
      setBusy(false);
    }
  }

  const active = conversations.find((c) => c.id === activeId) ?? null;

  return (
    <div className="csd-chat-workspace" data-testid="csd-chat-workspace">
      <aside className="csd-chat-workspace__list page-card">
        <div className="csd-chat-workspace__list-head">
          <h3 className="kpi-section-title">Hội thoại</h3>
          {canWrite ? (
            <button type="button" className="btn btn-sm btn-secondary" disabled={busy} onClick={() => void handleNewConversation()}>
              Mới
            </button>
          ) : null}
        </div>
        {error ? <p className="error">{error}</p> : null}
        <ul className="csd-chat-list">
          {conversations.length === 0 ? (
            <li className="muted">Chưa có hội thoại</li>
          ) : (
            conversations.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={`csd-chat-list__item${activeId === c.id ? ' is-active' : ''}`}
                  onClick={() => setActiveId(c.id)}
                >
                  <strong>{c.name_vi}</strong>
                  <span className="muted">{formatCsdWhen(c.last_message_at)}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </aside>

      <section className="csd-chat-workspace__thread page-card">
        {!active ? (
          <p className="muted">Chọn hội thoại để xem tin nhắn</p>
        ) : (
          <>
            <h3 className="kpi-section-title">{active.name_vi}</h3>
            <ul className="csd-chat-messages" data-testid="csd-chat-messages">
              {messages.map((m) => (
                <li key={m.id} className="csd-chat-message">
                  <div className="csd-chat-message__meta muted">
                    {m.author_staff_name ?? 'Khách'} · {formatCsdWhen(m.created_at)}
                  </div>
                  <p>{m.body_text}</p>
                  {canWrite ? (
                    <div className="csd-chat-message__actions">
                      {m.ticket_id ? (
                        <Link href={`/crm/csd/tickets/${m.ticket_id}`}>Ticket liên kết</Link>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={() => {
                            setTicketModal(m);
                            setTicketForm((f) => ({ ...f, title: m.body_text.slice(0, 120) }));
                          }}
                        >
                          Tạo ticket
                        </button>
                      )}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            {canWrite ? (
              <form onSubmit={(e) => void handleSend(e)} className="csd-chat-compose">
                <textarea
                  className="kpi-input"
                  rows={3}
                  placeholder="Nhập tin nhắn…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  data-testid="csd-chat-draft"
                />
                <button type="submit" className="btn btn-sm" disabled={busy || !draft.trim()}>
                  Gửi
                </button>
              </form>
            ) : null}
          </>
        )}
      </section>

      <aside className="csd-chat-workspace__context page-card stack-gap">
        <h3 className="kpi-section-title">Ngữ cảnh</h3>
        {active ? (
          <>
            <p className="muted">Loại: {active.kind === 'client' ? 'Khách hàng' : 'Nội bộ'}</p>
            <p className="muted">Tài khoản: {active.client_account_id ?? '—'}</p>
            <p className="muted">Poll tin nhắn mỗi 5 giây</p>
          </>
        ) : (
          <p className="muted">Chọn hội thoại để xem ngữ cảnh</p>
        )}
      </aside>

      {ticketModal ? (
        <div className="csd-modal-backdrop" role="presentation" onClick={() => setTicketModal(null)}>
          <form
            className="csd-modal page-card stack-gap"
            onSubmit={(e) => void handleCreateTicket(e)}
            onClick={(e) => e.stopPropagation()}
            data-testid="csd-create-ticket-modal"
          >
            <h3 className="kpi-section-title">Tạo ticket từ tin nhắn</h3>
            <input
              className="kpi-input"
              required
              value={ticketForm.title}
              onChange={(e) => setTicketForm({ ...ticketForm, title: e.target.value })}
              placeholder="Tiêu đề ticket"
            />
            <select
              className="kpi-select"
              value={ticketForm.ticket_type}
              onChange={(e) => setTicketForm({ ...ticketForm, ticket_type: e.target.value })}
            >
              {CSD_TICKET_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <select
              className="kpi-select"
              value={ticketForm.priority}
              onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value as CsdPriority })}
            >
              {(Object.keys(CSD_PRIORITY_LABELS) as CsdPriority[]).map((p) => (
                <option key={p} value={p}>
                  {CSD_PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
            <div className="csd-composer__actions">
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => setTicketModal(null)}>
                Huỷ
              </button>
              <button type="submit" className="btn btn-sm" disabled={busy}>
                Tạo ticket
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

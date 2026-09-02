'use client';

import { KeyboardEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CsdChatList } from '@/components/crm/csd/CsdChatList';
import { CsdChatNewModal } from '@/components/crm/csd/CsdChatNewModal';
import {
  addCsdConversationMember,
  closeCsdConversation,
  createCsdConversation,
  createCsdTicketFromMessage,
  draftCsdChatSummary,
  fetchCsdConversationMembers,
  fetchCsdConversations,
  fetchCsdMessages,
  markCsdConversationRead,
  reopenCsdConversation,
  removeCsdConversationMember,
  sendCsdMessage,
  formatCsdWhen,
  CSD_PRIORITY_LABELS,
  CSD_TICKET_TYPES,
  type CreateCsdConversationInput,
  type CsdConversationListFilter,
  type CsdConversationMemberRow,
  type CsdConversationRow,
  type CsdMessageRow,
  type CsdPriority,
} from '@/lib/crm/csd-api';

const KIND_LABELS: Record<string, string> = {
  client: 'Khách hàng',
  direct: 'DM',
  group: 'Nội bộ nhóm',
  project: 'Dự án',
  announcement: 'Thông báo',
};

type CsdChatWorkspaceProps = {
  token: string;
  canWrite: boolean;
};

type AiSummary = {
  summary: string;
  decisions: string[];
  actions: string[];
  risks: string[];
};

export function CsdChatWorkspace({ token, canWrite }: CsdChatWorkspaceProps) {
  const [conversations, setConversations] = useState<CsdConversationRow[]>([]);
  const [filter, setFilter] = useState<CsdConversationListFilter>('all');
  const [showNewModal, setShowNewModal] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CsdMessageRow[]>([]);
  const [members, setMembers] = useState<CsdConversationMemberRow[]>([]);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<CsdMessageRow | null>(null);
  const [memberStaffId, setMemberStaffId] = useState('');
  const [aiPeriod, setAiPeriod] = useState<'24h' | '7d' | 'all'>('24h');
  const [aiSummary, setAiSummary] = useState<AiSummary | null>(null);
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
      const out = await fetchCsdConversations(token, { filter });
      setConversations(out.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải hội thoại thất bại');
    }
  }, [token, filter]);

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

  const loadMembers = useCallback(
    async (conversationId: string) => {
      try {
        const out = await fetchCsdConversationMembers(token, conversationId);
        setMembers(out.items ?? []);
      } catch {
        setMembers([]);
      }
    },
    [token],
  );

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!activeId) return;
    setReplyTo(null);
    setAiSummary(null);
    void loadMessages(activeId);
    void loadMembers(activeId);
    const timer = window.setInterval(() => void loadMessages(activeId), 5000);
    return () => window.clearInterval(timer);
  }, [activeId, loadMessages, loadMembers]);

  function patchConversation(next: CsdConversationRow) {
    setConversations((prev) => prev.map((c) => (c.id === next.id ? { ...c, ...next } : c)));
  }

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    if (!activeId || !draft.trim() || !canWrite) return;
    setBusy(true);
    try {
      await sendCsdMessage(token, activeId, {
        body_text: draft.trim(),
        reply_to_id: replyTo?.id,
      });
      setDraft('');
      setReplyTo(null);
      await loadMessages(activeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gửi tin nhắn thất bại');
    } finally {
      setBusy(false);
    }
  }

  function onDraftKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  async function handleSelectConversation(id: string) {
    setActiveId(id);
    try {
      await markCsdConversationRead(token, id);
      await loadConversations();
    } catch {
      /* keep thread open even if read receipt fails */
    }
  }

  async function handleCreateConversation(payload: CreateCsdConversationInput) {
    if (!canWrite) return;
    setBusy(true);
    try {
      const row = await createCsdConversation(token, payload);
      setShowNewModal(false);
      setActiveId(row.id);
      if (filter !== 'all') {
        setFilter('all');
      } else {
        await loadConversations();
      }
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
      setMessages((prev) =>
        prev.map((m) =>
          m.id === ticketModal.id ? { ...m, ticket_id: ticket.id, ticket_code: ticket.code } : m,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo ticket thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!activeId) return;
    const staffId = Number(memberStaffId);
    if (!Number.isInteger(staffId) || staffId <= 0) return;
    setBusy(true);
    try {
      await addCsdConversationMember(token, activeId, { member_staff_id: staffId });
      setMemberStaffId('');
      await loadMembers(activeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thêm thành viên thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveMember(staffId: number) {
    if (!activeId) return;
    setBusy(true);
    try {
      await removeCsdConversationMember(token, activeId, staffId);
      await loadMembers(activeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xóa thành viên thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleClose() {
    if (!activeId) return;
    setBusy(true);
    try {
      const row = await closeCsdConversation(token, activeId);
      patchConversation(row);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đóng hội thoại thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleReopen() {
    if (!activeId) return;
    setBusy(true);
    try {
      const row = await reopenCsdConversation(token, activeId);
      patchConversation(row);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mở lại hội thoại thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleSummarize() {
    if (!activeId) return;
    setBusy(true);
    try {
      const out = await draftCsdChatSummary(token, activeId, aiPeriod);
      setAiSummary(out);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tóm tắt AI thất bại');
    } finally {
      setBusy(false);
    }
  }

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const closed = active?.status === 'closed';
  const isClient = active?.kind === 'client';

  return (
    <div className="csd-chat-workspace" data-testid="csd-chat-workspace">
      <CsdChatList
        conversations={conversations}
        activeId={activeId}
        filter={filter}
        canWrite={canWrite}
        busy={busy}
        error={error}
        onFilter={setFilter}
        onSelect={(id) => void handleSelectConversation(id)}
        onNew={() => setShowNewModal(true)}
      />

      <section className="csd-chat-workspace__thread page-card">
        {!active ? (
          <p className="muted">Chọn hội thoại để xem tin nhắn</p>
        ) : (
          <>
            <h3 className="kpi-section-title">{active.name_vi}</h3>
            {isClient ? (
              <p className="csd-chat-client-banner" data-testid="csd-chat-client-banner">
                Bạn đang gửi cho khách hàng
              </p>
            ) : null}
            <ul className="csd-chat-messages" data-testid="csd-chat-messages">
              {messages.map((m) => {
                const quoted = m.reply_to_id ? messages.find((q) => q.id === m.reply_to_id) : null;
                return (
                  <li key={m.id} className="csd-chat-message">
                    <div className="csd-chat-message__meta muted">
                      {m.author_staff_name ?? 'Khách'} · {formatCsdWhen(m.created_at)}
                    </div>
                    {quoted ? <p className="csd-chat-quote muted">↩ {quoted.body_text.slice(0, 120)}</p> : null}
                    <p>{m.body_text}</p>
                    {m.ticket_id ? (
                      <Link
                        href={`/crm/csd/tickets/${m.ticket_id}`}
                        className="csd-chat-ticket-pill"
                        data-testid="csd-chat-ticket-pill"
                      >
                        {m.ticket_code ?? 'Ticket liên kết'}
                      </Link>
                    ) : null}
                    {canWrite && !closed ? (
                      <div className="csd-chat-message__actions">
                        <button type="button" className="btn btn-sm btn-secondary" onClick={() => setReplyTo(m)}>
                          Trả lời
                        </button>
                        {!m.ticket_id && active.kind !== 'announcement' ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            onClick={() => {
                              setTicketModal(m);
                              setTicketForm((f) => ({ ...f, title: m.body_text.slice(0, 80) }));
                            }}
                          >
                            Tạo ticket
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {closed ? (
              <div className="csd-chat-closed">
                <p className="muted">Hội thoại đã đóng. Composer bị khóa.</p>
                {canWrite ? (
                  <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void handleReopen()}>
                    Mở lại
                  </button>
                ) : null}
              </div>
            ) : canWrite ? (
              <form onSubmit={(e) => void handleSend(e)} className="csd-chat-compose">
                {replyTo ? (
                  <div className="csd-chat-reply-bar">
                    <span>Trả lời: {replyTo.body_text.slice(0, 80)}</span>
                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => setReplyTo(null)}>
                      Huỷ
                    </button>
                  </div>
                ) : null}
                <textarea
                  className="kpi-input"
                  rows={3}
                  placeholder="Nhập tin nhắn… (Enter gửi, Shift+Enter xuống dòng)"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onDraftKeyDown}
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
            <p className="muted">Loại: {KIND_LABELS[active.kind] ?? active.kind}</p>
            <p className="muted">Tài khoản: {active.client_account_id ?? '—'}</p>
            {active.kind === 'project' ? (
              <p className="muted">
                Dự án: {active.project_ref_kind ?? '—'} / {active.project_ref_id ?? '—'}
              </p>
            ) : null}
            <p className="muted">Trạng thái: {closed ? 'Đã đóng' : active.status ?? 'active'}</p>
            {canWrite && !closed ? (
              <button type="button" className="btn btn-sm btn-secondary" disabled={busy} onClick={() => void handleClose()}>
                Đóng hội thoại
              </button>
            ) : null}

            <h4 className="kpi-section-title">Thành viên</h4>
            <ul className="csd-chat-members" data-testid="csd-chat-members">
              {members.length === 0 ? (
                <li className="muted">Chưa có thành viên</li>
              ) : (
                members.map((m) => (
                  <li key={`${m.conversation_id}-${m.member_staff_id}`}>
                    Staff #{m.member_staff_id} · {m.role === 'owner' ? 'Chủ' : m.role}
                    {canWrite && m.role !== 'owner' ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        disabled={busy}
                        onClick={() => void handleRemoveMember(m.member_staff_id)}
                      >
                        Xóa
                      </button>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
            {canWrite && !closed ? (
              <form onSubmit={(e) => void handleAddMember(e)} className="csd-chat-member-form">
                <input
                  className="kpi-input"
                  inputMode="numeric"
                  placeholder="Staff id"
                  value={memberStaffId}
                  onChange={(e) => setMemberStaffId(e.target.value)}
                  data-testid="csd-chat-member-id"
                />
                <button type="submit" className="btn btn-sm" disabled={busy || !memberStaffId.trim()}>
                  Thêm
                </button>
              </form>
            ) : null}

            <h4 className="kpi-section-title">Tóm tắt AI</h4>
            <div className="csd-chat-ai-period">
              {(['24h', '7d', 'all'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`btn btn-sm btn-secondary${aiPeriod === p ? ' is-active' : ''}`}
                  onClick={() => setAiPeriod(p)}
                >
                  {p}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-sm"
              disabled={busy}
              onClick={() => void handleSummarize()}
              data-testid="csd-chat-ai-summary"
            >
              Tóm tắt AI
            </button>
            {aiSummary ? (
              <div className="csd-chat-ai-output" data-testid="csd-chat-ai-output">
                <p>
                  <strong>Tóm tắt</strong>
                  <br />
                  {aiSummary.summary}
                </p>
                <p>
                  <strong>Quyết định</strong>
                  <br />
                  {aiSummary.decisions.join(' · ') || '—'}
                </p>
                <p>
                  <strong>Action</strong>
                  <br />
                  {aiSummary.actions.join(' · ') || '—'}
                </p>
                <p>
                  <strong>Rủi ro</strong>
                  <br />
                  {aiSummary.risks.join(' · ') || '—'}
                </p>
              </div>
            ) : null}
          </>
        ) : (
          <p className="muted">Chọn hội thoại để xem ngữ cảnh</p>
        )}
      </aside>

      {showNewModal ? (
        <CsdChatNewModal
          open
          busy={busy}
          onClose={() => setShowNewModal(false)}
          onSubmit={(payload) => handleCreateConversation(payload)}
        />
      ) : null}

      {ticketModal ? (
        <div className="csd-modal-backdrop" role="presentation" onClick={() => setTicketModal(null)}>
          <form
            className="csd-modal page-card stack-gap"
            onSubmit={(e) => void handleCreateTicket(e)}
            onClick={(e) => e.stopPropagation()}
            data-testid="csd-create-ticket-modal"
          >
            <h3 className="kpi-section-title">Tạo ticket từ tin nhắn</h3>
            <p className="muted">
              {active?.name_vi ?? 'Hội thoại'} · {formatCsdWhen(ticketModal.created_at)}
            </p>
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

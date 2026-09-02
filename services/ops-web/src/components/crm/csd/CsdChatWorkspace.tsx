'use client';

import { useCallback, useEffect, useState } from 'react';
import { CsdChatContext } from '@/components/crm/csd/CsdChatContext';
import { CsdChatList } from '@/components/crm/csd/CsdChatList';
import { CsdChatNewModal } from '@/components/crm/csd/CsdChatNewModal';
import { CsdChatThread } from '@/components/crm/csd/CsdChatThread';
import {
  addCsdConversationMember,
  closeCsdConversation,
  createCsdConversation,
  createCsdTicketFromMessage,
  deleteCsdMessage,
  draftCsdChatSummary,
  editCsdMessage,
  fetchCsdConversationMembers,
  fetchCsdConversations,
  fetchCsdMessages,
  fetchCsdRelatedTickets,
  markCsdConversationRead,
  reopenCsdConversation,
  removeCsdConversationMember,
  sendCsdMessage,
  uploadCsdConversationFile,
  formatCsdWhen,
  CSD_PRIORITY_LABELS,
  CSD_TICKET_TYPES,
  type CreateCsdConversationInput,
  type CsdConversationListFilter,
  type CsdConversationMemberRow,
  type CsdAttachmentRow,
  type CsdConversationRow,
  type CsdMessageRow,
  type CsdPriority,
  type CsdTicketRow,
} from '@/lib/crm/csd-api';

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
  const [search, setSearch] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CsdMessageRow[]>([]);
  const [meStaffId, setMeStaffId] = useState<number | null>(null);
  const [pendingFiles, setPendingFiles] = useState<CsdAttachmentRow[]>([]);
  const [members, setMembers] = useState<CsdConversationMemberRow[]>([]);
  const [relatedTickets, setRelatedTickets] = useState<CsdTicketRow[]>([]);
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
      const q = search.trim();
      const out = await fetchCsdConversations(token, {
        filter,
        ...(q.length >= 2 ? { q } : {}),
      });
      setConversations(out.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải hội thoại thất bại');
    }
  }, [token, filter, search]);

  const loadMessages = useCallback(
    async (conversationId: string) => {
      try {
        const out = await fetchCsdMessages(token, conversationId);
        setMessages(out.items ?? []);
        if (typeof out.me_staff_id === 'number') setMeStaffId(out.me_staff_id);
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

  const loadRelatedTickets = useCallback(
    async (conversationId: string) => {
      try {
        const out = await fetchCsdRelatedTickets(token, conversationId);
        setRelatedTickets(out.items ?? []);
      } catch {
        setRelatedTickets([]);
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
    setPendingFiles([]);
    setAiSummary(null);
    setRelatedTickets([]);
    void loadMessages(activeId);
    void loadMembers(activeId);
    void loadRelatedTickets(activeId);
    const timer = window.setInterval(() => void loadMessages(activeId), 5000);
    return () => window.clearInterval(timer);
  }, [activeId, loadMessages, loadMembers, loadRelatedTickets]);

  function patchConversation(next: CsdConversationRow) {
    setConversations((prev) => prev.map((c) => (c.id === next.id ? { ...c, ...next } : c)));
  }

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    if (!activeId || !canWrite || (!draft.trim() && pendingFiles.length === 0)) return;
    setBusy(true);
    try {
      await sendCsdMessage(token, activeId, {
        body_text: draft.trim(),
        reply_to_id: replyTo?.id,
        attachment_ids: pendingFiles.map((f) => f.id),
      });
      setDraft('');
      setReplyTo(null);
      setPendingFiles([]);
      await loadMessages(activeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gửi tin nhắn thất bại');
    } finally {
      setBusy(false);
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
      if (ticket.skipped_internal_files?.length) {
        setError('Ticket đã tạo. File nội bộ không được copy sang ticket.');
      }
      setTicketModal(null);
      setTicketForm({ title: '', ticket_type: 'request', priority: 'P3' });
      if (activeId) {
        await loadMessages(activeId);
        await loadRelatedTickets(activeId);
      }
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

  async function handleAddMember() {
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

  async function handlePickFile(file: File) {
    if (!activeId || !canWrite) return;
    setBusy(true);
    try {
      const uploaded = await uploadCsdConversationFile(token, activeId, file);
      setPendingFiles((prev) => [...prev, uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải file thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleEditMessage(message: CsdMessageRow, bodyText: string) {
    setBusy(true);
    try {
      const next = await editCsdMessage(token, message.id, bodyText);
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, ...next } : m)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sửa tin nhắn thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteMessage(message: CsdMessageRow) {
    setBusy(true);
    try {
      const next = await deleteCsdMessage(token, message.id);
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, ...next, is_deleted: true, body_text: '' } : m)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xóa tin nhắn thất bại');
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

  return (
    <div className="csd-chat-workspace" data-testid="csd-chat-workspace">
      <CsdChatList
        conversations={conversations}
        activeId={activeId}
        filter={filter}
        canWrite={canWrite}
        busy={busy}
        error={error}
        search={search}
        onSearch={setSearch}
        onFilter={setFilter}
        onSelect={(id) => void handleSelectConversation(id)}
        onNew={() => setShowNewModal(true)}
      />

      <CsdChatThread
        token={token}
        active={active}
        messages={messages}
        members={members}
        relatedTickets={relatedTickets}
        draft={draft}
        replyTo={replyTo}
        pendingFiles={pendingFiles}
        meStaffId={meStaffId}
        canWrite={canWrite}
        busy={busy}
        closed={Boolean(closed)}
        onDraftChange={setDraft}
        onSend={() => void handleSend()}
        onReply={setReplyTo}
        onCancelReply={() => setReplyTo(null)}
        onCreateTicket={(m) => {
          setTicketModal(m);
          setTicketForm((f) => ({ ...f, title: m.body_text.slice(0, 80) }));
        }}
        onReopen={() => void handleReopen()}
        onPickFile={(file) => void handlePickFile(file)}
        onRemovePending={(id) => setPendingFiles((prev) => prev.filter((f) => f.id !== id))}
        onEditMessage={(m, body) => void handleEditMessage(m, body)}
        onDeleteMessage={(m) => void handleDeleteMessage(m)}
      />

      <CsdChatContext
        active={active}
        members={members}
        relatedTickets={relatedTickets}
        memberStaffId={memberStaffId}
        aiPeriod={aiPeriod}
        aiSummary={aiSummary}
        canWrite={canWrite}
        busy={busy}
        closed={Boolean(closed)}
        onMemberStaffId={setMemberStaffId}
        onAddMember={() => void handleAddMember()}
        onRemoveMember={(staffId) => void handleRemoveMember(staffId)}
        onClose={() => void handleClose()}
        onAiPeriod={setAiPeriod}
        onSummarize={() => void handleSummarize()}
      />

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

'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent, type Dispatch, type SetStateAction } from 'react';
import { ApiError } from '@/lib/api';
import {
  addCsdConversationMember,
  archiveCsdConversation,
  closeCsdConversation,
  createCsdConversation,
  createCsdTicketFromAiAction,
  createCsdTicketFromMessage,
  deleteCsdMessage,
  draftCsdChatSummary,
  editCsdMessage,
  fetchCsdConversationMembers,
  fetchCsdConversations,
  fetchCsdMessages,
  fetchCsdRelatedTickets,
  forwardCsdMessage,
  markCsdConversationRead,
  patchCsdConversationAlias,
  reactCsdMessage,
  reopenCsdConversation,
  removeCsdConversationMember,
  sendCsdMessage,
  uploadCsdConversationFile,
  type CreateCsdConversationInput,
  type CsdConversationListFilter,
  type CsdConversationMemberRow,
  type CsdAttachmentRow,
  type CsdChatEmotionId,
  type CsdConversationRow,
  type CsdMessageRow,
  type CsdPriority,
  type CsdTicketRow,
} from '@/lib/crm/csd-api';
import { writeCsdChatViewing } from '@/lib/crm/csd-chat-notify-persist';

export type CsdChatAiSummary = {
  summary: string;
  decisions: string[];
  actions: string[];
  risks: string[];
  ai_interaction_id?: string;
};

export type CsdChatMobilePane = 'list' | 'thread' | 'context';

export type CsdChatSessionOptions = {
  token: string;
  canWrite: boolean;
  initialConversationId?: string | null;
  pollMs?: number;
  listPollMs?: number;
  enabled?: boolean;
};

export type CsdChatSession = {
  conversations: CsdConversationRow[];
  filter: CsdConversationListFilter;
  search: string;
  setSearch: (q: string) => void;
  setFilter: (f: CsdConversationListFilter) => void;
  showNewModal: boolean;
  setShowNewModal: (v: boolean) => void;
  showCreateGroupModal: boolean;
  setShowCreateGroupModal: (v: boolean) => void;
  activeId: string | null;
  active: CsdConversationRow | null;
  messages: CsdMessageRow[];
  meStaffId: number | null;
  pendingFiles: CsdAttachmentRow[];
  members: CsdConversationMemberRow[];
  relatedTickets: CsdTicketRow[];
  draft: string;
  setDraft: (v: string) => void;
  replyTo: CsdMessageRow | null;
  setReplyTo: (m: CsdMessageRow | null) => void;
  memberStaffId: string;
  setMemberStaffId: (v: string) => void;
  aiPeriod: '24h' | '7d' | 'all';
  setAiPeriod: (v: '24h' | '7d' | 'all') => void;
  aiSummary: CsdChatAiSummary | null;
  error: string;
  busy: boolean;
  ticketModal: CsdMessageRow | null;
  setTicketModal: (m: CsdMessageRow | null) => void;
  ticketForm: { title: string; ticket_type: string; priority: CsdPriority };
  setTicketForm: Dispatch<SetStateAction<{ title: string; ticket_type: string; priority: CsdPriority }>>;
  priorityHint: 'P1' | 'P2' | null;
  setPriorityHint: (v: 'P1' | 'P2' | null) => void;
  duplicateTicket: CsdTicketRow | null;
  setDuplicateTicket: (t: CsdTicketRow | null) => void;
  forwardMessage: CsdMessageRow | null;
  setForwardMessage: (m: CsdMessageRow | null) => void;
  forwardTargetId: string;
  setForwardTargetId: (v: string) => void;
  mobilePane: CsdChatMobilePane;
  setMobilePane: (p: CsdChatMobilePane) => void;
  isMobile: boolean;
  friendRequired: boolean;
  setFriendRequired: (v: boolean) => void;
  handleSelectConversation: (id: string) => Promise<void>;
  handleCreateConversation: (payload: CreateCsdConversationInput) => Promise<boolean>;
  handleRenameConversation: (aliasVi: string) => Promise<boolean>;
  handleSend: (e?: FormEvent, bodyOverride?: string) => Promise<void>;
  handleSendEmotion: (emoji: string) => Promise<void>;
  handleReactMessage: (message: CsdMessageRow, emotion: CsdChatEmotionId) => Promise<void>;
  handleCreateTicket: (e: FormEvent) => Promise<void>;
  handleAddMember: () => Promise<void>;
  handleRemoveMember: (staffId: number) => Promise<void>;
  handleClose: () => Promise<void>;
  handleReopen: () => Promise<void>;
  handleArchive: () => Promise<void>;
  handlePickFile: (file: File) => Promise<void>;
  handleRemovePending: (fileId: string) => void;
  handleEditMessage: (message: CsdMessageRow, bodyText: string) => Promise<void>;
  handleDeleteMessage: (message: CsdMessageRow) => Promise<void>;
  handleForward: () => Promise<void>;
  handleCreateAiActionTicket: (actionIndex: number, title: string) => Promise<void>;
  handleSummarize: () => Promise<void>;
  handleCopyLink: (message: CsdMessageRow) => void;
};

export function useCsdChatSession({
  token,
  canWrite,
  initialConversationId,
  pollMs = 5000,
  listPollMs,
  enabled = true,
}: CsdChatSessionOptions): CsdChatSession {
  const [conversations, setConversations] = useState<CsdConversationRow[]>([]);
  const [filter, setFilter] = useState<CsdConversationListFilter>('all');
  const [search, setSearch] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
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
  const [aiSummary, setAiSummary] = useState<CsdChatAiSummary | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ticketModal, setTicketModal] = useState<CsdMessageRow | null>(null);
  const [ticketForm, setTicketForm] = useState({
    title: '',
    ticket_type: 'request',
    priority: 'P3' as CsdPriority,
  });
  const [priorityHint, setPriorityHint] = useState<'P1' | 'P2' | null>(null);
  const [duplicateTicket, setDuplicateTicket] = useState<CsdTicketRow | null>(null);
  const [forwardMessage, setForwardMessage] = useState<CsdMessageRow | null>(null);
  const [forwardTargetId, setForwardTargetId] = useState('');
  const [mobilePane, setMobilePane] = useState<CsdChatMobilePane>('list');
  const [isMobile, setIsMobile] = useState(false);
  const [friendRequired, setFriendRequired] = useState(false);
  const sendingRef = useRef(false);

  const mergeMessages = useCallback((prev: CsdMessageRow[], next: CsdMessageRow[]) => {
    if (prev.length === next.length && prev.every((m, i) => m.id === next[i]?.id)) return prev;
    const byId = new Map(prev.map((m) => [m.id, m]));
    return next.map((m) => {
      const old = byId.get(m.id);
      if (!old) return m;
      return {
        ...m,
        attachments: m.attachments ?? old.attachments,
        reactions: m.reactions ?? old.reactions,
      };
    });
  }, []);

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
        setMessages((prev) => mergeMessages(prev, out.items ?? []));
        if (typeof out.me_staff_id === 'number') setMeStaffId(out.me_staff_id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải tin nhắn thất bại');
      }
    },
    [token, mergeMessages],
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
    if (!enabled || !token) return;
    void loadConversations();
    if (!listPollMs) return;
    const timer = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void loadConversations();
    }, listPollMs);
    return () => window.clearInterval(timer);
  }, [enabled, token, loadConversations, listPollMs]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 960px)');
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (!initialConversationId) return;
    setActiveId(initialConversationId);
    if (isMobile) setMobilePane('thread');
  }, [initialConversationId, isMobile]);

  useEffect(() => {
    writeCsdChatViewing(activeId);
    return () => {
      writeCsdChatViewing(null);
    };
  }, [activeId]);

  useEffect(() => {
    if (!enabled || !token || !activeId) return;
    setReplyTo(null);
    setPendingFiles([]);
    setAiSummary(null);
    setRelatedTickets([]);
    void loadMessages(activeId);
    void loadMembers(activeId);
    void loadRelatedTickets(activeId);
    const timer = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void loadMessages(activeId);
    }, pollMs);
    return () => window.clearInterval(timer);
  }, [enabled, token, activeId, loadMessages, loadMembers, loadRelatedTickets, pollMs]);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  function patchConversation(next: CsdConversationRow) {
    setConversations((prev) => prev.map((c) => (c.id === next.id ? { ...c, ...next } : c)));
  }

  async function handleSend(e?: FormEvent, bodyOverride?: string) {
    e?.preventDefault();
    if (sendingRef.current || busy) return;
    const isEmotion = bodyOverride != null;
    const body = (isEmotion ? bodyOverride : draft).trim();
    if (!activeId || !canWrite || (!body && (isEmotion || pendingFiles.length === 0))) return;
    sendingRef.current = true;
    setBusy(true);
    try {
      const sent = await sendCsdMessage(token, activeId, {
        body_text: body,
        reply_to_id: isEmotion ? undefined : replyTo?.id,
        attachment_ids: isEmotion ? [] : pendingFiles.map((f) => f.id),
      });
      if (!isEmotion) {
        setDraft('');
        setReplyTo(null);
        setPendingFiles([]);
      }
      setPriorityHint(sent.priority_suggestion ?? null);
      setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gửi tin nhắn thất bại');
    } finally {
      sendingRef.current = false;
      setBusy(false);
    }
  }

  async function handleSendEmotion(emoji: string) {
    await handleSend(undefined, emoji);
  }

  async function handleSelectConversation(id: string) {
    setActiveId(id);
    setPriorityHint(null);
    if (isMobile) setMobilePane('thread');
    try {
      await markCsdConversationRead(token, id);
      await loadConversations();
    } catch {
      /* keep thread open even if read receipt fails */
    }
  }

  async function handleRenameConversation(aliasVi: string): Promise<boolean> {
    if (!activeId || !canWrite) return false;
    setBusy(true);
    try {
      const row = await patchCsdConversationAlias(token, activeId, aliasVi);
      patchConversation(row);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đổi tên thất bại');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateConversation(payload: CreateCsdConversationInput): Promise<boolean> {
    if (!canWrite) return false;
    setBusy(true);
    try {
      const row = await createCsdConversation(token, payload);
      setConversations((prev) => [row, ...prev.filter((c) => c.id !== row.id)]);
      setShowNewModal(false);
      setShowCreateGroupModal(false);
      setActiveId(row.id);
      if (filter !== 'all') {
        setFilter('all');
      } else {
        await loadConversations();
      }
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.message === 'not_friends') {
        setFriendRequired(true);
        return false;
      }
      setError(err instanceof Error ? err.message : 'Tạo hội thoại thất bại');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateTicket(e: FormEvent) {
    e.preventDefault();
    if (!ticketModal || !ticketForm.title.trim()) return;
    setBusy(true);
    try {
      const ticket = await createCsdTicketFromMessage(token, ticketModal.id, ticketForm);
      if (ticket.already_exists) {
        setTicketModal(null);
        setDuplicateTicket(ticket);
        setTicketForm({ title: '', ticket_type: 'request', priority: 'P3' });
        return;
      }
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

  function handleRemovePending(fileId: string) {
    setPendingFiles((prev) => prev.filter((f) => f.id !== fileId));
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

  async function handleReactMessage(message: CsdMessageRow, emotion: CsdChatEmotionId) {
    if (!canWrite) return;
    try {
      const out = await reactCsdMessage(token, message.id, emotion);
      setMessages((prev) =>
        prev.map((m) => (m.id === message.id ? { ...m, reactions: out.reactions } : m)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gửi emotion thất bại');
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

  async function handleArchive() {
    if (!activeId) return;
    setBusy(true);
    try {
      const row = await archiveCsdConversation(token, activeId);
      patchConversation(row);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu trữ hội thoại thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleForward() {
    if (!forwardMessage || !forwardTargetId.trim()) return;
    setBusy(true);
    try {
      await forwardCsdMessage(token, forwardTargetId.trim(), forwardMessage.id);
      setForwardMessage(null);
      setForwardTargetId('');
      if (activeId === forwardTargetId.trim()) await loadMessages(activeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chuyển tiếp thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateAiActionTicket(actionIndex: number, title: string) {
    if (!aiSummary?.ai_interaction_id || !canWrite) return;
    setBusy(true);
    try {
      const ticket = await createCsdTicketFromAiAction(token, aiSummary.ai_interaction_id, actionIndex, {
        title,
        ticket_type: 'request',
        priority: 'P3',
        client_account_id: active?.client_account_id ?? undefined,
      });
      if (ticket.already_exists) {
        setDuplicateTicket(ticket);
        return;
      }
      if (activeId) await loadRelatedTickets(activeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo ticket từ AI action thất bại');
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

  function handleCopyLink(message: CsdMessageRow) {
    if (!active) return;
    const url = `${window.location.origin}/crm/csd/chat?c=${active.id}&m=${message.id}`;
    void navigator.clipboard.writeText(url);
  }

  return {
    conversations,
    filter,
    search,
    setSearch,
    setFilter,
    showNewModal,
    setShowNewModal,
    showCreateGroupModal,
    setShowCreateGroupModal,
    activeId,
    active,
    messages,
    meStaffId,
    pendingFiles,
    members,
    relatedTickets,
    draft,
    setDraft,
    replyTo,
    setReplyTo,
    memberStaffId,
    setMemberStaffId,
    aiPeriod,
    setAiPeriod,
    aiSummary,
    error,
    busy,
    ticketModal,
    setTicketModal,
    ticketForm,
    setTicketForm,
    priorityHint,
    setPriorityHint,
    duplicateTicket,
    setDuplicateTicket,
    forwardMessage,
    setForwardMessage,
    forwardTargetId,
    setForwardTargetId,
    mobilePane,
    setMobilePane,
    isMobile,
    friendRequired,
    setFriendRequired,
    handleSelectConversation,
    handleCreateConversation,
    handleRenameConversation,
    handleSend,
    handleSendEmotion,
    handleReactMessage,
    handleCreateTicket,
    handleAddMember,
    handleRemoveMember,
    handleClose,
    handleReopen,
    handleArchive,
    handlePickFile,
    handleRemovePending,
    handleEditMessage,
    handleDeleteMessage,
    handleForward,
    handleCreateAiActionTicket,
    handleSummarize,
    handleCopyLink,
  };
}

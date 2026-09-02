'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CsdChatContacts } from '@/components/crm/csd/CsdChatContacts';
import { CsdChatContext } from '@/components/crm/csd/CsdChatContext';
import { CsdChatList } from '@/components/crm/csd/CsdChatList';
import { CsdChatNewModal } from '@/components/crm/csd/CsdChatNewModal';
import { CsdChatTabs } from '@/components/crm/csd/CsdChatTabs';
import { CsdChatThread } from '@/components/crm/csd/CsdChatThread';
import { useCsdChatSession } from '@/components/crm/csd/useCsdChatSession';
import { getAccessToken, hasCap, type StoredStaffUser } from '@/lib/auth';
import {
  CSD_PRIORITY_LABELS,
  CSD_TICKET_TYPES,
  fetchCsdChatMe,
  fetchCsdChatUnreadCount,
  formatCsdWhen,
  type CsdPriority,
} from '@/lib/crm/csd-api';
import {
  readCsdDockPersist,
  writeCsdDockPersist,
  type CsdDockPane,
  type CsdDockTab,
} from '@/lib/crm/csd-chat-dock-persist';

export function CsdChatDock({ user }: { user: StoredStaffUser | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const token = getAccessToken() ?? '';
  const canWrite = hasCap(user, 'csd', 'write');
  const canView = hasCap(user, 'csd', 'view');
  const [meEnabled, setMeEnabled] = useState<boolean | null>(null);
  const hidden = !user || !canView || pathname === '/crm/csd/chat' || !token || meEnabled !== true;

  const initial = readCsdDockPersist();
  const [open, setOpen] = useState(initial.open);
  const [pane, setPane] = useState<CsdDockPane>(initial.pane);
  const [tab, setTab] = useState<CsdDockTab>(initial.tab);
  const [incomingCount, setIncomingCount] = useState(0);
  const [infoOpen, setInfoOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const s = useCsdChatSession({
    token,
    canWrite,
    initialConversationId: initial.conversationId,
    pollMs: 15_000,
    listPollMs: 15_000,
    enabled: !hidden && open,
  });

  const persist = useCallback(
    (next: { open?: boolean; pane?: CsdDockPane; tab?: CsdDockTab; conversationId?: string | null }) => {
      const current = readCsdDockPersist();
      writeCsdDockPersist({
        open: next.open ?? current.open,
        tab: next.tab ?? current.tab,
        pane: next.pane ?? current.pane,
        conversationId: next.conversationId !== undefined ? next.conversationId : current.conversationId,
      });
    },
    [],
  );

  useEffect(() => {
    if (!user || !canView || !token || pathname === '/crm/csd/chat') {
      setMeEnabled(false);
      return;
    }
    let cancelled = false;
    void fetchCsdChatMe(token)
      .then((me) => {
        if (!cancelled) setMeEnabled(me.enabled === true);
      })
      .catch(() => {
        if (!cancelled) setMeEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, canView, token, pathname]);

  useEffect(() => {
    if (hidden || !token) return;
    let cancelled = false;
    const load = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void fetchCsdChatUnreadCount(token)
        .then((out) => {
          if (!cancelled) setUnread(Number(out.count ?? 0));
        })
        .catch(() => {
          /* keep last badge */
        });
    };
    load();
    const timer = window.setInterval(load, 15_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [hidden, token]);

  useEffect(() => {
    if (hidden || !open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (infoOpen) {
        setInfoOpen(false);
        return;
      }
      if (pane === 'thread') {
        setPane('list');
        persist({ pane: 'list' });
        return;
      }
      setOpen(false);
      persist({ open: false });
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hidden, open, pane, persist, infoOpen]);

  if (hidden) return null;

  const archived = s.active?.status === 'archived';
  const closed = s.active?.status === 'closed';
  const composerLocked = Boolean(closed || archived);

  function minimize() {
    setOpen(false);
    persist({ open: false, pane, conversationId: s.activeId });
  }

  function expand() {
    const id = s.activeId;
    setOpen(false);
    persist({ open: false, pane, conversationId: id });
    router.push(id ? `/crm/csd/chat?c=${id}` : '/crm/csd/chat');
  }

  return (
    <>
      {!open ? (
        <button
          type="button"
          className="csd-chat-launcher"
          data-testid="csd-chat-launcher"
          aria-label="Chat"
          aria-expanded={false}
          onClick={() => {
            setOpen(true);
            persist({ open: true, pane, conversationId: s.activeId ?? initial.conversationId });
          }}
        >
          Chat
          {unread > 0 ? (
            <span className="csd-chat-launcher__badge" aria-label={`${unread} hội thoại chưa đọc`}>
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </button>
      ) : (
        <div
          className="csd-chat-dock"
          id="csd-chat-dock"
          role="dialog"
          aria-label="Chat Service Desk"
          data-testid="csd-chat-dock"
        >
          {pane === 'list' ? (
            <header className="csd-chat-dock__head">
              <strong>Chat nội bộ</strong>
              <div className="csd-chat-dock__head-actions">
                <button type="button" className="btn btn-sm btn-secondary" onClick={expand}>
                  Mở rộng
                </button>
                <button type="button" className="btn btn-sm btn-secondary" aria-label="Thu nhỏ" onClick={minimize}>
                  —
                </button>
              </div>
            </header>
          ) : null}
          <div className="csd-chat-dock__body">
            {pane === 'list' ? (
              <div className="csd-chat-workspace__list-col">
                <CsdChatTabs
                  tab={tab}
                  incomingCount={incomingCount}
                  onChange={(next) => {
                    setTab(next);
                    persist({ tab: next, pane: 'list' });
                  }}
                />
                {tab === 'messages' ? (
                  <CsdChatList
                    conversations={s.conversations}
                    activeId={s.activeId}
                    filter={s.filter}
                    canWrite={canWrite}
                    busy={s.busy}
                    error={s.error}
                    search={s.search}
                    onSearch={s.setSearch}
                    onFilter={s.setFilter}
                    onSelect={(id) => {
                      setPane('thread');
                      persist({ open: true, pane: 'thread', conversationId: id });
                      void s.handleSelectConversation(id);
                    }}
                    onNew={() => s.setShowNewModal(true)}
                  />
                ) : (
                  <CsdChatContacts
                    token={token}
                    mode={tab === 'requests' ? 'requests' : 'directory'}
                    canWrite={canWrite}
                    onIncomingChange={setIncomingCount}
                    onOpenDm={(staffId) => {
                      setTab('messages');
                      persist({ tab: 'messages', pane: 'thread' });
                      setPane('thread');
                      void s.handleCreateConversation({ kind: 'direct', name_vi: '', member_staff_ids: [staffId] });
                    }}
                  />
                )}
              </div>
            ) : (
              <CsdChatThread
                token={token}
                active={s.active}
                messages={s.messages}
                members={s.members}
                relatedTickets={s.relatedTickets}
                draft={s.draft}
                replyTo={s.replyTo}
                pendingFiles={s.pendingFiles}
                meStaffId={s.meStaffId}
                canWrite={canWrite}
                busy={s.busy}
                closed={composerLocked}
                priorityHint={s.priorityHint}
                density="dock"
                showMobileBack
                onExpand={expand}
                onMinimize={minimize}
                onShowContext={() => setInfoOpen(true)}
                onMobileBack={() => {
                  setInfoOpen(false);
                  setPane('list');
                  persist({ pane: 'list' });
                }}
                onDismissPriorityHint={() => s.setPriorityHint(null)}
                onApplyPriorityHint={() => {
                  if (!s.priorityHint) return;
                  const hint = s.priorityHint;
                  s.setPriorityHint(null);
                  const last = [...s.messages].reverse().find((m) => !m.is_deleted && m.body_text.trim());
                  if (last) {
                    s.setTicketModal(last);
                    s.setTicketForm((f) => ({
                      ...f,
                      title: last.body_text.slice(0, 80),
                      ticket_type: 'incident',
                      priority: hint,
                    }));
                  }
                }}
                onDraftChange={s.setDraft}
                onSend={() => void s.handleSend()}
                onReply={s.setReplyTo}
                onCancelReply={() => s.setReplyTo(null)}
                onCreateTicket={(m) => {
                  s.setTicketModal(m);
                  s.setTicketForm((f) => ({ ...f, title: m.body_text.slice(0, 80) }));
                }}
                onReopen={() => void s.handleReopen()}
                onPickFile={(file) => void s.handlePickFile(file)}
                onRemovePending={s.handleRemovePending}
                onEditMessage={(m, body) => void s.handleEditMessage(m, body)}
                onDeleteMessage={(m) => void s.handleDeleteMessage(m)}
                onCopyLink={s.handleCopyLink}
                onForward={(m) => s.setForwardMessage(m)}
              />
            )}
          </div>

          {infoOpen ? (
            <div className="csd-chat-dock__overlay" data-testid="csd-chat-info-sheet">
              <div className="csd-chat-info-sheet page-card stack-gap">
                <div className="csd-chat-info-sheet__head">
                  <strong>Hội thoại</strong>
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => setInfoOpen(false)}>
                    Đóng
                  </button>
                </div>
                <CsdChatContext
                  variant="sheet"
                  active={s.active}
                  members={s.members}
                  relatedTickets={s.relatedTickets}
                  memberStaffId={s.memberStaffId}
                  aiPeriod={s.aiPeriod}
                  aiSummary={s.aiSummary}
                  canWrite={canWrite}
                  busy={s.busy}
                  closed={composerLocked}
                  archived={archived}
                  onMemberStaffId={s.setMemberStaffId}
                  onAddMember={() => void s.handleAddMember()}
                  onRemoveMember={(staffId) => void s.handleRemoveMember(staffId)}
                  onClose={() => void s.handleClose()}
                  onArchive={() => void s.handleArchive()}
                  onCreateAiActionTicket={(index, title) => void s.handleCreateAiActionTicket(index, title)}
                  onAiPeriod={s.setAiPeriod}
                  onSummarize={() => void s.handleSummarize()}
                />
              </div>
            </div>
          ) : null}

          {s.showNewModal ? (
            <div className="csd-chat-dock__overlay">
              <CsdChatNewModal
                token={token}
                open
                busy={s.busy}
                onClose={() => s.setShowNewModal(false)}
                onSubmit={async (payload) => {
                  const ok = await s.handleCreateConversation(payload);
                  if (!ok) return;
                  setPane('thread');
                  persist({ open: true, pane: 'thread' });
                }}
              />
            </div>
          ) : null}

          {s.friendRequired ? (
            <div className="csd-chat-dock__overlay" role="presentation" onClick={() => s.setFriendRequired(false)}>
              <div
                className="csd-modal page-card stack-gap"
                onClick={(e) => e.stopPropagation()}
                data-testid="csd-chat-not-friends"
              >
                <h3 className="kpi-section-title">Hãy gửi kết bạn trước</h3>
                <p>DM mới chỉ mở với người đã chấp nhận lời mời.</p>
                <div className="csd-composer__actions">
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => s.setFriendRequired(false)}>
                    Đóng
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      s.setFriendRequired(false);
                      s.setShowNewModal(false);
                      setPane('list');
                      setTab('contacts');
                      persist({ pane: 'list', tab: 'contacts' });
                    }}
                  >
                    Mở Danh bạ
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {s.duplicateTicket ? (
            <div className="csd-chat-dock__overlay" role="presentation" onClick={() => s.setDuplicateTicket(null)}>
              <div className="csd-modal page-card stack-gap" onClick={(e) => e.stopPropagation()} data-testid="csd-duplicate-ticket-modal">
                <h3 className="kpi-section-title">Đã có ticket từ nguồn này</h3>
                <p>
                  Mã <strong>{s.duplicateTicket.code}</strong> — {s.duplicateTicket.title}
                </p>
                <div className="csd-composer__actions">
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => s.setDuplicateTicket(null)}>
                    Đóng
                  </button>
                  <Link href={`/crm/csd/tickets/${s.duplicateTicket.id}`} className="btn btn-sm">
                    Mở ticket
                  </Link>
                </div>
              </div>
            </div>
          ) : null}

          {s.forwardMessage ? (
            <div className="csd-chat-dock__overlay" role="presentation" onClick={() => s.setForwardMessage(null)}>
              <form
                className="csd-modal page-card stack-gap"
                onSubmit={(e) => {
                  e.preventDefault();
                  void s.handleForward();
                }}
                onClick={(e) => e.stopPropagation()}
                data-testid="csd-forward-modal"
              >
                <h3 className="kpi-section-title">Chuyển tiếp tin nhắn</h3>
                <p className="muted">{s.forwardMessage.body_text.slice(0, 120)}</p>
                <input
                  className="kpi-input"
                  required
                  placeholder="ID hội thoại đích"
                  value={s.forwardTargetId}
                  onChange={(e) => s.setForwardTargetId(e.target.value)}
                  data-testid="csd-forward-target"
                />
                <div className="csd-composer__actions">
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => s.setForwardMessage(null)}>
                    Huỷ
                  </button>
                  <button type="submit" className="btn btn-sm" disabled={s.busy}>
                    Chuyển tiếp
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          {s.ticketModal ? (
            <div className="csd-chat-dock__overlay" role="presentation" onClick={() => s.setTicketModal(null)}>
              <form
                className="csd-modal page-card stack-gap"
                onSubmit={(e) => void s.handleCreateTicket(e)}
                onClick={(e) => e.stopPropagation()}
                data-testid="csd-create-ticket-modal"
              >
                <h3 className="kpi-section-title">Tạo ticket từ tin nhắn</h3>
                <p className="muted">
                  {s.active?.name_vi ?? 'Hội thoại'} · {formatCsdWhen(s.ticketModal.created_at)}
                </p>
                <input
                  className="kpi-input"
                  required
                  value={s.ticketForm.title}
                  onChange={(e) => s.setTicketForm({ ...s.ticketForm, title: e.target.value })}
                  placeholder="Tiêu đề ticket"
                />
                <select
                  className="kpi-select"
                  value={s.ticketForm.ticket_type}
                  onChange={(e) => s.setTicketForm({ ...s.ticketForm, ticket_type: e.target.value })}
                >
                  {CSD_TICKET_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <select
                  className="kpi-select"
                  value={s.ticketForm.priority}
                  onChange={(e) => s.setTicketForm({ ...s.ticketForm, priority: e.target.value as CsdPriority })}
                >
                  {(Object.keys(CSD_PRIORITY_LABELS) as CsdPriority[]).map((p) => (
                    <option key={p} value={p}>
                      {CSD_PRIORITY_LABELS[p]}
                    </option>
                  ))}
                </select>
                <div className="csd-composer__actions">
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => s.setTicketModal(null)}>
                    Huỷ
                  </button>
                  <button type="submit" className="btn btn-sm" disabled={s.busy}>
                    Tạo ticket
                  </button>
                </div>
              </form>
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}

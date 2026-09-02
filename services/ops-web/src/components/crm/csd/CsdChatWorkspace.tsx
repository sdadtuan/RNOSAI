'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CsdChatContacts } from '@/components/crm/csd/CsdChatContacts';
import { CsdChatContext } from '@/components/crm/csd/CsdChatContext';
import { CsdChatList } from '@/components/crm/csd/CsdChatList';
import { CsdChatCreateGroupModal } from '@/components/crm/csd/CsdChatCreateGroupModal';
import { CsdChatNewModal } from '@/components/crm/csd/CsdChatNewModal';
import { CsdChatTabs } from '@/components/crm/csd/CsdChatTabs';
import { CsdChatThread } from '@/components/crm/csd/CsdChatThread';
import { useCsdChatSession } from '@/components/crm/csd/useCsdChatSession';
import { formatCsdWhen, CSD_PRIORITY_LABELS, CSD_TICKET_TYPES, type CsdPriority } from '@/lib/crm/csd-api';
import type { CsdDockTab } from '@/lib/crm/csd-chat-dock-persist';

type CsdChatWorkspaceProps = {
  token: string;
  canWrite: boolean;
  initialConversationId?: string | null;
};

export function CsdChatWorkspace({ token, canWrite, initialConversationId }: CsdChatWorkspaceProps) {
  const s = useCsdChatSession({ token, canWrite, initialConversationId });
  const [tab, setTab] = useState<CsdDockTab>('messages');
  const [incomingCount, setIncomingCount] = useState(0);
  const archived = s.active?.status === 'archived';
  const closed = s.active?.status === 'closed';
  const composerLocked = Boolean(closed || archived);

  const workspaceClass = [
    'csd-chat-workspace',
    s.isMobile && s.mobilePane === 'list' ? 'is-mobile-list' : '',
    s.isMobile && s.mobilePane === 'thread' ? 'is-mobile-thread' : '',
    s.isMobile && s.mobilePane === 'context' ? 'is-mobile-context' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={workspaceClass} data-testid="csd-chat-workspace">
      {(!s.isMobile || s.mobilePane === 'list') && (
        <>
        <CsdChatTabs variant="rail" tab={tab} incomingCount={incomingCount} onChange={setTab} />
        <div className="csd-chat-workspace__list-col">
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
              onSelect={(id) => void s.handleSelectConversation(id)}
              onNew={() => s.setShowNewModal(true)}
              onCreateGroup={() => s.setShowCreateGroupModal(true)}
            />
          ) : (
            <CsdChatContacts
              token={token}
              mode={tab === 'requests' ? 'requests' : 'directory'}
              canWrite={canWrite}
              onIncomingChange={setIncomingCount}
              onOpenDm={(staffId) => {
                setTab('messages');
                void s.handleCreateConversation({ kind: 'direct', name_vi: '', member_staff_ids: [staffId] });
              }}
            />
          )}
        </div>
        </>
      )}

      {(!s.isMobile || s.mobilePane === 'thread') && (
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
          density="page"
          showMobileBack={s.isMobile}
          onMobileBack={() => s.setMobilePane('list')}
          onShowContext={s.isMobile ? () => s.setMobilePane('context') : undefined}
          onRename={(aliasVi) => s.handleRenameConversation(aliasVi)}
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
          onSendEmotion={(emoji) => void s.handleSendEmotion(emoji)}
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

      {(!s.isMobile || s.mobilePane === 'context') && (
        <CsdChatContext
          active={s.active}
          members={s.members}
          relatedTickets={s.relatedTickets}
          memberStaffId={s.memberStaffId}
          aiPeriod={s.aiPeriod}
          aiSummary={s.aiSummary}
          canWrite={canWrite}
          busy={s.busy}
          closed={composerLocked}
          archived={Boolean(archived)}
          onMemberStaffId={s.setMemberStaffId}
          onAddMember={() => void s.handleAddMember()}
          onRemoveMember={(staffId) => void s.handleRemoveMember(staffId)}
          onClose={() => void s.handleClose()}
          onArchive={() => void s.handleArchive()}
          onCreateAiActionTicket={(index, title) => void s.handleCreateAiActionTicket(index, title)}
          onAiPeriod={s.setAiPeriod}
          onSummarize={() => void s.handleSummarize()}
          showMobileBack={s.isMobile}
          onMobileBack={() => s.setMobilePane('thread')}
          onRename={(aliasVi) => s.handleRenameConversation(aliasVi)}
        />
      )}

      {s.isMobile && s.mobilePane === 'thread' ? (
        <button
          type="button"
          className="btn btn-sm btn-secondary csd-chat-mobile-info"
          data-testid="csd-chat-mobile-info"
          onClick={() => s.setMobilePane('context')}
        >
          i
        </button>
      ) : null}

      {s.showNewModal ? (
        <CsdChatNewModal
          token={token}
          open
          busy={s.busy}
          onClose={() => s.setShowNewModal(false)}
          onSubmit={async (payload) => {
            await s.handleCreateConversation(payload);
          }}
        />
      ) : null}

      {s.showCreateGroupModal ? (
        <CsdChatCreateGroupModal
          token={token}
          open
          busy={s.busy}
          onClose={() => s.setShowCreateGroupModal(false)}
          onSubmit={(payload) => s.handleCreateConversation(payload)}
        />
      ) : null}

      {s.friendRequired ? (
        <div className="csd-modal-backdrop" role="presentation" onClick={() => s.setFriendRequired(false)}>
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
                  setTab('contacts');
                }}
              >
                Mở Danh bạ
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {s.duplicateTicket ? (
        <div className="csd-modal-backdrop" role="presentation" onClick={() => s.setDuplicateTicket(null)}>
          <div
            className="csd-modal page-card stack-gap"
            onClick={(e) => e.stopPropagation()}
            data-testid="csd-duplicate-ticket-modal"
          >
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
        <div className="csd-modal-backdrop" role="presentation" onClick={() => s.setForwardMessage(null)}>
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
        <div className="csd-modal-backdrop" role="presentation" onClick={() => s.setTicketModal(null)}>
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
  );
}

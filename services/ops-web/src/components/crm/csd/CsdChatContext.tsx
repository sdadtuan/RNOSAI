'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CsdChatAvatar } from '@/components/crm/csd/CsdChatAvatar';
import { CsdChatContextMedia } from '@/components/crm/csd/CsdChatContextMedia';
import { CsdChatStorageVault, type CsdChatStorageTab } from '@/components/crm/csd/CsdChatStorageVault';
import {
  type CsdChatPersonRow,
  type CsdConversationMemberRow,
  type CsdConversationRow,
  type CsdGroupJoinRequestRow,
  type CsdTicketRow,
} from '@/lib/crm/csd-api';
import type { CsdConversationLinkItem, CsdConversationMediaItem } from '@/lib/crm/csd-chat-display';
import { resolveCsdConversationAvatar } from '@/lib/crm/csd-chat-display';

export const CSD_CHAT_KIND_LABELS: Record<string, string> = {
  client: 'Khách hàng',
  direct: 'DM',
  group: 'Nội bộ nhóm',
  project: 'Dự án',
  announcement: 'Thông báo',
};

function roleBadgeVi(role: CsdConversationMemberRow['role']): string {
  if (role === 'owner') return 'Chủ';
  if (role === 'admin') return 'Phó';
  if (role === 'viewer') return 'Xem';
  return 'TV';
}

type CsdChatContextProps = {
  token: string;
  active: CsdConversationRow | null;
  attachmentImages: CsdConversationMediaItem[];
  attachmentFiles: CsdConversationMediaItem[];
  attachmentLinks?: CsdConversationLinkItem[];
  attachmentsLoading?: boolean;
  attachmentsError?: string;
  members: CsdConversationMemberRow[];
  relatedTickets: CsdTicketRow[];
  memberStaffId: string;
  meStaffId?: number | null;
  friendInviteOptions?: CsdChatPersonRow[];
  aiPeriod: '24h' | '7d' | 'all';
  aiSummary: AiSummary | null;
  canWrite: boolean;
  busy: boolean;
  closed: boolean;
  archived: boolean;
  onMemberStaffId: (value: string) => void;
  onAddMember: () => void;
  onRemoveMember: (staffId: number) => void;
  onLoadFriendInvites?: () => void;
  onPatchGroupInfo?: (patch: {
    name_vi?: string;
    description?: string;
    join_approval_required?: boolean;
    members_can_send?: boolean;
  }) => Promise<boolean>;
  onSetMemberRole?: (staffId: number, role: 'admin' | 'member') => void;
  onUploadGroupAvatar?: (file: File) => void;
  onClearGroupAvatar?: () => void;
  joinRequests?: CsdGroupJoinRequestRow[];
  onLoadJoinRequests?: () => void;
  onApproveJoin?: (requestId: string) => void;
  onRejectJoin?: (requestId: string) => void;
  onTransferOwner?: (staffId: number) => void;
  onClose: () => void;
  onArchive: () => void;
  onCreateAiActionTicket: (index: number, title: string) => void;
  onAiPeriod: (period: '24h' | '7d' | 'all') => void;
  onSummarize: () => void;
  showMobileBack?: boolean;
  onMobileBack?: () => void;
  onClosePanel?: () => void;
  onRename?: (aliasVi: string) => Promise<boolean>;
  variant?: 'column' | 'sheet';
};

type AiSummary = {
  summary: string;
  decisions: string[];
  actions: string[];
  risks: string[];
  ai_interaction_id?: string;
};

function ContextSection({
  title,
  open,
  onToggle,
  testId,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <section className="csd-chat-context-section">
      <button
        type="button"
        className="csd-chat-context-section__head"
        aria-expanded={open}
        data-testid={testId}
        onClick={onToggle}
      >
        <span>{title}</span>
        <span className="csd-chat-context-section__chev" aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open ? <div className="csd-chat-context-section__body">{children}</div> : null}
    </section>
  );
}

export function CsdChatContext({
  token,
  active,
  attachmentImages,
  attachmentFiles,
  attachmentLinks = [],
  attachmentsLoading = false,
  attachmentsError = '',
  members,
  relatedTickets,
  memberStaffId,
  meStaffId = null,
  friendInviteOptions = [],
  aiPeriod,
  aiSummary,
  canWrite,
  busy,
  closed,
  archived,
  onMemberStaffId,
  onAddMember,
  onRemoveMember,
  onLoadFriendInvites,
  onPatchGroupInfo,
  onSetMemberRole,
  onUploadGroupAvatar,
  onClearGroupAvatar,
  joinRequests = [],
  onLoadJoinRequests,
  onApproveJoin,
  onRejectJoin,
  onTransferOwner,
  onClose,
  onArchive,
  onCreateAiActionTicket,
  onAiPeriod,
  onSummarize,
  showMobileBack,
  onMobileBack,
  onClosePanel,
  onRename,
  variant = 'column',
}: CsdChatContextProps) {
  const isSheet = variant === 'sheet';
  const isGroup = active?.kind === 'group';
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [groupInfoOpen, setGroupInfoOpen] = useState(true);
  const [rolesOpen, setRolesOpen] = useState(true);
  const [joinOpen, setJoinOpen] = useState(true);
  const [ticketsOpen, setTicketsOpen] = useState(true);
  const [membersOpen, setMembersOpen] = useState(true);
  const [aiOpen, setAiOpen] = useState(false);
  const [vaultTab, setVaultTab] = useState<CsdChatStorageTab | null>(null);
  const [aliasDraft, setAliasDraft] = useState(active?.alias_vi || active?.name_vi || '');
  const [groupNameDraft, setGroupNameDraft] = useState(active?.name_vi || '');
  const [groupDescDraft, setGroupDescDraft] = useState(active?.description || '');

  const myRole = useMemo(() => {
    if (meStaffId == null) return null;
    return members.find((m) => m.member_staff_id === meStaffId)?.role ?? null;
  }, [members, meStaffId]);

  const canManageGroup = Boolean(
    canWrite && isGroup && (myRole === 'owner' || myRole === 'admin') && !closed && !archived,
  );
  const canSetAdmin = Boolean(canWrite && isGroup && myRole === 'owner' && !closed && !archived);
  const canManageMembersUi = canManageGroup;

  useEffect(() => {
    setAliasDraft(active?.alias_vi || active?.name_vi || '');
    setGroupNameDraft(active?.name_vi || '');
    setGroupDescDraft(active?.description || '');
    setDetailsOpen(false);
    setGroupInfoOpen(true);
    setRolesOpen(true);
    setTicketsOpen(true);
    setMembersOpen(true);
    setAiOpen(false);
    setVaultTab(null);
  }, [active?.id, active?.alias_vi, active?.name_vi, active?.description]);

  useEffect(() => {
    if (isGroup && canManageMembersUi) {
      onLoadFriendInvites?.();
      onLoadJoinRequests?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unstable callback identity
  }, [isGroup, canManageMembersUi, active?.id]);

  const memberIds = useMemo(() => new Set(members.map((m) => m.member_staff_id)), [members]);
  const inviteCandidates = friendInviteOptions.filter((p) => !memberIds.has(p.staff_id));
  const leaders = members.filter((m) => m.role === 'owner' || m.role === 'admin');
  const groupAvatar = active ? resolveCsdConversationAvatar(active) : null;

  if (vaultTab && active) {
    return (
      <aside className={`csd-chat-workspace__context csd-chat-context-panel${isSheet ? ' is-sheet' : ''}`}>
        <CsdChatStorageVault
          token={token}
          tab={vaultTab}
          images={attachmentImages}
          files={attachmentFiles}
          links={attachmentLinks}
          loading={attachmentsLoading}
          error={attachmentsError}
          onTabChange={setVaultTab}
          onClose={() => setVaultTab(null)}
        />
      </aside>
    );
  }

  return (
    <aside className={`csd-chat-workspace__context csd-chat-context-panel${isSheet ? ' is-sheet' : ''}`}>
      {showMobileBack && !isSheet ? (
        <button type="button" className="csd-chat-context-back" onClick={onMobileBack}>
          ← Hội thoại
        </button>
      ) : null}
      {active ? (
        <>
          {onClosePanel ? (
            <header className="csd-chat-context-head">
              <h3 className="csd-chat-context-head__title">Thông tin hội thoại</h3>
              <button
                type="button"
                className="csd-chat-context-head__close"
                aria-label="Ẩn thông tin"
                data-testid="csd-chat-context-panel-close"
                onClick={onClosePanel}
              >
                ×
              </button>
            </header>
          ) : isSheet ? (
            <header className="csd-chat-context-head">
              <h3 className="csd-chat-context-head__title">Thông tin</h3>
            </header>
          ) : null}

          <div className="csd-chat-context-scroll stack-gap">
            {isGroup ? (
              <ContextSection
                title="Thông tin nhóm"
                open={groupInfoOpen}
                onToggle={() => setGroupInfoOpen((v) => !v)}
                testId="csd-chat-group-info-toggle"
              >
                <div className="csd-chat-group-info stack-gap" data-testid="csd-chat-group-info">
                  <div className="csd-chat-group-info__avatar-row">
                    <CsdChatAvatar
                      token={token}
                      name={active.name_vi}
                      seed={groupAvatar?.seed ?? active.id}
                      staffId={groupAvatar?.staffId}
                      conversationId={groupAvatar?.conversationId}
                      hasAvatar={groupAvatar?.hasAvatar}
                      avatarUpdatedAt={groupAvatar?.avatarUpdatedAt}
                      className="csd-chat-avatar csd-chat-avatar--thread"
                    />
                    {canManageGroup && onUploadGroupAvatar ? (
                      <label className="csd-chat-context-link-btn">
                        Đổi ảnh
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          hidden
                          data-testid="csd-chat-group-avatar-input"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (file) onUploadGroupAvatar(file);
                          }}
                        />
                      </label>
                    ) : null}
                    {canManageGroup && active.group_has_avatar && onClearGroupAvatar ? (
                      <button
                        type="button"
                        className="csd-chat-context-link-btn"
                        disabled={busy}
                        onClick={onClearGroupAvatar}
                      >
                        Xóa ảnh
                      </button>
                    ) : null}
                  </div>
                  {canManageGroup && onPatchGroupInfo ? (
                    <form
                      className="csd-chat-rename csd-chat-rename--stack"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void onPatchGroupInfo({
                          name_vi: groupNameDraft.trim(),
                          description: groupDescDraft,
                        });
                      }}
                    >
                      <label className="csd-chat-context-label" htmlFor="csd-chat-group-name">
                        Tên nhóm
                      </label>
                      <input
                        id="csd-chat-group-name"
                        className="csd-chat-context-input"
                        value={groupNameDraft}
                        maxLength={191}
                        onChange={(e) => setGroupNameDraft(e.target.value)}
                        data-testid="csd-chat-group-name-input"
                      />
                      <label className="csd-chat-context-label" htmlFor="csd-chat-group-desc">
                        Mô tả
                      </label>
                      <textarea
                        id="csd-chat-group-desc"
                        className="csd-chat-context-input"
                        rows={3}
                        value={groupDescDraft}
                        onChange={(e) => setGroupDescDraft(e.target.value)}
                        data-testid="csd-chat-group-desc-input"
                      />
                      <button
                        type="submit"
                        className="csd-chat-context-btn"
                        disabled={busy || !groupNameDraft.trim()}
                        data-testid="csd-chat-group-info-save"
                      >
                        Lưu thông tin
                      </button>
                    </form>
                  ) : (
                    <>
                      <p className="csd-chat-context-line">
                        <span>Tên nhóm</span>
                        <strong>{active.name_vi}</strong>
                      </p>
                      <p className="csd-chat-context-line">
                        <span>Mô tả</span>
                        <strong>{active.description?.trim() || '—'}</strong>
                      </p>
                    </>
                  )}
                  {canManageGroup && onPatchGroupInfo ? (
                    <div className="csd-chat-zalo-toggles" data-testid="csd-chat-group-moderation">
                      <label className="csd-chat-zalo-toggle">
                        <span>Cần duyệt khi mời</span>
                        <input
                          type="checkbox"
                          checked={Boolean(active.join_approval_required)}
                          disabled={busy}
                          onChange={(e) => {
                            void onPatchGroupInfo({ join_approval_required: e.target.checked });
                          }}
                          data-testid="csd-chat-join-approval-toggle"
                        />
                      </label>
                      <label className="csd-chat-zalo-toggle">
                        <span>Chỉ Chủ/Phó được gửi</span>
                        <input
                          type="checkbox"
                          checked={active.members_can_send === false}
                          disabled={busy}
                          onChange={(e) => {
                            void onPatchGroupInfo({ members_can_send: !e.target.checked });
                          }}
                          data-testid="csd-chat-send-lock-toggle"
                        />
                      </label>
                    </div>
                  ) : null}
                </div>
              </ContextSection>
            ) : null}

            <ContextSection
              title="Chi tiết hội thoại"
              open={detailsOpen}
              onToggle={() => setDetailsOpen((v) => !v)}
              testId="csd-chat-context-toggle"
            >
              <div className="csd-chat-context-meta stack-gap" data-testid="csd-chat-context-meta">
                <p className="csd-chat-context-line">
                  <span>Loại</span>
                  <strong>{CSD_CHAT_KIND_LABELS[active.kind] ?? active.kind}</strong>
                </p>
                <p className="csd-chat-context-line">
                  <span>Tên hiển thị</span>
                  <strong>{active.name_vi}</strong>
                </p>
                {onRename && canWrite ? (
                  <form
                    className="csd-chat-rename csd-chat-rename--stack"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void onRename(aliasDraft.trim());
                    }}
                  >
                    <label className="csd-chat-context-label" htmlFor="csd-chat-context-rename">
                      Tên gợi nhớ (chỉ mình bạn thấy)
                    </label>
                    <input
                      id="csd-chat-context-rename"
                      className="csd-chat-context-input"
                      value={aliasDraft}
                      maxLength={191}
                      onChange={(e) => setAliasDraft(e.target.value)}
                      placeholder={active.name_vi}
                      data-testid="csd-chat-context-rename-input"
                    />
                    <button
                      type="submit"
                      className="csd-chat-context-btn"
                      disabled={busy}
                      data-testid="csd-chat-context-rename-save"
                    >
                      Lưu tên
                    </button>
                  </form>
                ) : null}
                <p className="csd-chat-context-line">
                  <span>Tài khoản</span>
                  <strong>{active.client_account_id ?? '—'}</strong>
                </p>
                {active.kind === 'project' ? (
                  <p className="csd-chat-context-line">
                    <span>Dự án</span>
                    <strong>
                      {active.project_ref_kind ?? '—'} / {active.project_ref_id ?? '—'}
                    </strong>
                  </p>
                ) : null}
                <p className="csd-chat-context-line">
                  <span>Trạng thái</span>
                  <strong>{archived ? 'Lưu trữ' : closed ? 'Đã đóng' : active.status ?? 'active'}</strong>
                </p>
                {!isSheet && canWrite && !closed && !archived ? (
                  <button type="button" className="csd-chat-context-btn csd-chat-context-btn--ghost" disabled={busy} onClick={onClose}>
                    Đóng hội thoại
                  </button>
                ) : null}
                {!isSheet && canWrite && !archived ? (
                  <button
                    type="button"
                    className="csd-chat-context-btn csd-chat-context-btn--ghost"
                    disabled={busy}
                    onClick={onArchive}
                    data-testid="csd-chat-archive"
                  >
                    Lưu trữ
                  </button>
                ) : null}
              </div>
            </ContextSection>

            <section className="csd-chat-context-all-media" data-testid="csd-chat-context-all-media">
              <h4 className="csd-chat-context-all-media__title">Ảnh &amp; File (tất cả hội thoại)</h4>
              <CsdChatContextMedia
                token={token}
                loading={attachmentsLoading}
                error={attachmentsError}
                images={attachmentImages}
                files={attachmentFiles}
                links={attachmentLinks}
                onOpenVault={setVaultTab}
              />
            </section>

            <ContextSection title="Ticket liên quan" open={ticketsOpen} onToggle={() => setTicketsOpen((v) => !v)}>
              <ul className="csd-chat-related" data-testid="csd-chat-related-tickets">
                {relatedTickets.length === 0 ? (
                  <li className="csd-chat-context-empty">Chưa có ticket</li>
                ) : (
                  relatedTickets.map((t) => (
                    <li key={t.id}>
                      <Link href={`/crm/csd/tickets/${t.id}`} className="csd-chat-ticket-pill">
                        {t.code} · {t.priority} · {t.status}
                      </Link>
                      <span className="csd-chat-context-sub">{t.title}</span>
                    </li>
                  ))
                )}
              </ul>
            </ContextSection>

            {isGroup ? (
              <ContextSection
                title="Yêu cầu vào nhóm"
                open={joinOpen}
                onToggle={() => setJoinOpen((v) => !v)}
                testId="csd-chat-join-requests-toggle"
              >
                <ul className="csd-chat-members" data-testid="csd-chat-join-requests">
                  {joinRequests.length === 0 ? (
                    <li className="csd-chat-context-empty">Không có yêu cầu chờ duyệt</li>
                  ) : (
                    joinRequests.map((r) => (
                      <li key={r.id}>
                        <span className="csd-chat-members__name">
                          {r.requester_display_name_vi || `Staff #${r.requester_staff_id}`}
                        </span>
                        {canManageMembersUi ? (
                          <span className="csd-chat-members__actions">
                            <button
                              type="button"
                              className="csd-chat-context-link-btn"
                              disabled={busy}
                              onClick={() => onApproveJoin?.(r.id)}
                            >
                              Duyệt
                            </button>
                            <button
                              type="button"
                              className="csd-chat-context-link-btn"
                              disabled={busy}
                              onClick={() => onRejectJoin?.(r.id)}
                            >
                              Từ chối
                            </button>
                          </span>
                        ) : null}
                      </li>
                    ))
                  )}
                </ul>
              </ContextSection>
            ) : null}

            {isGroup ? (
              <ContextSection
                title="Vai trò"
                open={rolesOpen}
                onToggle={() => setRolesOpen((v) => !v)}
                testId="csd-chat-group-roles-toggle"
              >
                <ul className="csd-chat-members" data-testid="csd-chat-group-roles">
                  {leaders.length === 0 ? (
                    <li className="csd-chat-context-empty">Chưa có</li>
                  ) : (
                    leaders.map((m) => (
                      <li key={`role-${m.member_staff_id}`}>
                        <span className="csd-chat-members__name">
                          {m.display_name_vi || 'Thành viên'} · {roleBadgeVi(m.role)}
                        </span>
                        {canSetAdmin && m.role === 'admin' && onSetMemberRole ? (
                          <button
                            type="button"
                            className="csd-chat-context-link-btn"
                            disabled={busy}
                            onClick={() => onSetMemberRole(m.member_staff_id, 'member')}
                          >
                            Gỡ phó
                          </button>
                        ) : null}
                      </li>
                    ))
                  )}
                </ul>
              </ContextSection>
            ) : null}

            <ContextSection title="Thành viên" open={membersOpen} onToggle={() => setMembersOpen((v) => !v)}>
              <ul className="csd-chat-members" data-testid="csd-chat-members">
                {members.length === 0 ? (
                  <li className="csd-chat-context-empty">Chưa có thành viên</li>
                ) : (
                  members.map((m) => {
                    const canRemove =
                      canManageMembersUi &&
                      m.role !== 'owner' &&
                      (myRole === 'owner' || m.role === 'member' || m.role === 'viewer');
                    return (
                      <li key={`${m.conversation_id}-${m.member_staff_id}`}>
                        <span className="csd-chat-members__name">
                          {m.display_name_vi || 'Thành viên'} · {roleBadgeVi(m.role)}
                        </span>
                        <span className="csd-chat-members__actions">
                          {canSetAdmin && (m.role === 'member' || m.role === 'viewer') && onSetMemberRole ? (
                            <button
                              type="button"
                              className="csd-chat-context-link-btn"
                              disabled={busy}
                              onClick={() => onSetMemberRole(m.member_staff_id, 'admin')}
                            >
                              Đặt phó
                            </button>
                          ) : null}
                          {canSetAdmin && m.role !== 'owner' && onTransferOwner ? (
                            <button
                              type="button"
                              className="csd-chat-context-link-btn"
                              disabled={busy}
                              onClick={() => onTransferOwner(m.member_staff_id)}
                            >
                              Chuyển chủ
                            </button>
                          ) : null}
                          {canRemove ? (
                            <button
                              type="button"
                              className="csd-chat-context-link-btn"
                              disabled={busy}
                              onClick={() => onRemoveMember(m.member_staff_id)}
                            >
                              Xóa
                            </button>
                          ) : null}
                        </span>
                      </li>
                    );
                  })
                )}
              </ul>
              {!isSheet && canManageMembersUi ? (
                isGroup ? (
                  <div className="csd-chat-member-form stack-gap" data-testid="csd-chat-group-invite">
                    <label className="csd-chat-context-label" htmlFor="csd-chat-member-friend">
                      Mời bạn bè vào nhóm
                    </label>
                    <select
                      id="csd-chat-member-friend"
                      className="csd-chat-context-input"
                      value={memberStaffId}
                      onChange={(e) => onMemberStaffId(e.target.value)}
                      data-testid="csd-chat-member-friend"
                    >
                      <option value="">Chọn bạn bè…</option>
                      {inviteCandidates.map((p) => (
                        <option key={p.staff_id} value={String(p.staff_id)}>
                          {p.display_name_vi || `Staff #${p.staff_id}`}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="csd-chat-context-btn csd-chat-context-btn--soft"
                      disabled={busy || !memberStaffId.trim()}
                      onClick={onAddMember}
                    >
                      Mời vào nhóm
                    </button>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      onAddMember();
                    }}
                    className="csd-chat-member-form"
                  >
                    <input
                      className="csd-chat-context-input"
                      inputMode="numeric"
                      placeholder="Staff id"
                      value={memberStaffId}
                      onChange={(e) => onMemberStaffId(e.target.value)}
                      data-testid="csd-chat-member-id"
                    />
                    <button
                      type="submit"
                      className="csd-chat-context-btn csd-chat-context-btn--soft"
                      disabled={busy || !memberStaffId.trim()}
                    >
                      Thêm
                    </button>
                  </form>
                )
              ) : null}
            </ContextSection>

            {isSheet ? null : (
              <ContextSection title="Tóm tắt AI" open={aiOpen} onToggle={() => setAiOpen((v) => !v)}>
                <div className="csd-chat-ai-period">
                  {(['24h', '7d', 'all'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`csd-chat-context-chip${aiPeriod === p ? ' is-active' : ''}`}
                      onClick={() => onAiPeriod(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="csd-chat-context-btn csd-chat-context-btn--wide"
                  disabled={busy}
                  onClick={onSummarize}
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
                    </p>
                    {aiSummary.actions.length === 0 ? (
                      <p className="csd-chat-context-empty">—</p>
                    ) : (
                      <ul className="csd-chat-ai-actions" data-testid="csd-chat-ai-actions">
                        {aiSummary.actions.map((action, index) => (
                          <li key={`${index}-${action.slice(0, 24)}`}>
                            <label>
                              <input type="checkbox" readOnly checked /> {action}
                            </label>
                            {canWrite ? (
                              <button
                                type="button"
                                className="csd-chat-context-link-btn"
                                disabled={busy || !aiSummary.ai_interaction_id}
                                onClick={() => onCreateAiActionTicket(index, action.slice(0, 255))}
                              >
                                Tạo ticket
                              </button>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                    <p>
                      <strong>Rủi ro</strong>
                      <br />
                      {aiSummary.risks.join(' · ') || '—'}
                    </p>
                  </div>
                ) : null}
              </ContextSection>
            )}
          </div>
        </>
      ) : (
        <p className="csd-chat-context-empty">Chọn hội thoại để xem thông tin</p>
      )}
    </aside>
  );
}

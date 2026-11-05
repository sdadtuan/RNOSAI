'use client';

import { CsdChatAvatar } from '@/components/crm/csd/CsdChatAvatar';
import type { CsdConversationMemberRow } from '@/lib/crm/csd-api';

function roleLabel(role: CsdConversationMemberRow['role']): string {
  if (role === 'owner') return 'Trưởng nhóm';
  if (role === 'admin') return 'Phó nhóm';
  if (role === 'viewer') return 'Xem';
  return '';
}

type CsdChatGroupMembersPanelProps = {
  token: string;
  members: CsdConversationMemberRow[];
  meStaffId: number | null;
  canInvite: boolean;
  canLeave: boolean;
  busy?: boolean;
  onClose: () => void;
  onAddMembers: () => void;
  onLeaveGroup?: () => void;
};

export function CsdChatGroupMembersPanel({
  token,
  members,
  meStaffId,
  canInvite,
  canLeave,
  busy = false,
  onClose,
  onAddMembers,
  onLeaveGroup,
}: CsdChatGroupMembersPanelProps) {
  return (
    <div className="csd-chat-members-panel" data-testid="csd-chat-members-panel" role="dialog" aria-modal="true">
      <header className="csd-chat-members-panel__head">
        <button
          type="button"
          className="csd-chat-icon-btn"
          aria-label="Quay lại"
          data-testid="csd-chat-members-panel-back"
          onClick={onClose}
        >
          ←
        </button>
        <h3>Thành viên</h3>
        <span className="csd-chat-members-panel__spacer" />
      </header>

      {canInvite ? (
        <button
          type="button"
          className="csd-chat-members-panel__add"
          data-testid="csd-chat-members-panel-add"
          disabled={busy}
          onClick={onAddMembers}
        >
          <span className="csd-chat-thread-ico csd-chat-thread-ico--add-member" aria-hidden />
          Thêm thành viên
        </button>
      ) : null}

      <div className="csd-chat-members-panel__section">
        <div className="csd-chat-members-panel__section-head">
          <strong>Danh sách thành viên ({members.length})</strong>
        </div>
        <ul className="csd-chat-members-panel__list" data-testid="csd-chat-members-panel-list">
          {members.map((m) => {
            const isMe = meStaffId != null && m.member_staff_id === meStaffId;
            const name = m.display_name_vi?.trim() || `Staff #${m.member_staff_id}`;
            const badge = roleLabel(m.role);
            return (
              <li key={m.member_staff_id}>
                <span className="csd-chat-members-panel__avatar-wrap">
                  <CsdChatAvatar
                    token={token}
                    name={name}
                    seed={m.member_staff_id}
                    staffId={m.member_staff_id}
                    hasAvatar={m.has_avatar}
                    avatarUpdatedAt={m.avatar_updated_at ?? null}
                    className="csd-chat-avatar csd-chat-avatar--list"
                  />
                  {m.role === 'owner' ? (
                    <span className="csd-chat-members-panel__owner-key" aria-hidden title="Trưởng nhóm">
                      ♔
                    </span>
                  ) : null}
                </span>
                <span className="csd-chat-members-panel__meta">
                  <strong>{isMe ? 'Bạn' : name}</strong>
                  {badge ? <span className="csd-chat-members-panel__role">{badge}</span> : null}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {canLeave && onLeaveGroup ? (
        <div className="csd-chat-members-panel__footer">
          <button
            type="button"
            className="csd-chat-context-btn csd-chat-context-btn--ghost csd-chat-context-btn--wide"
            disabled={busy}
            data-testid="csd-chat-members-panel-leave"
            onClick={onLeaveGroup}
          >
            Rời nhóm
          </button>
        </div>
      ) : null}
    </div>
  );
}

'use client';

import { CsdChatAvatar } from '@/components/crm/csd/CsdChatAvatar';
import {
  resolveGroupAvatarMembers,
  type CsdGroupAvatarMemberPreview,
} from '@/lib/crm/csd-chat-display';

type CsdChatGroupAvatarProps = {
  token: string;
  name: string;
  conversationId: string;
  groupHasAvatar?: boolean;
  groupAvatarUpdatedAt?: string | null;
  groupAvatarPreview?: CsdGroupAvatarMemberPreview[] | null;
  members?: Array<
    CsdGroupAvatarMemberPreview & {
      role?: string;
      created_at?: string;
    }
  > | null;
  className?: string;
};

export function CsdChatGroupAvatar({
  token,
  name,
  conversationId,
  groupHasAvatar = false,
  groupAvatarUpdatedAt = null,
  groupAvatarPreview = null,
  members = null,
  className = 'csd-chat-avatar csd-chat-avatar--list',
}: CsdChatGroupAvatarProps) {
  if (groupHasAvatar) {
    return (
      <CsdChatAvatar
        token={token}
        name={name}
        seed={conversationId}
        conversationId={conversationId}
        hasAvatar
        avatarUpdatedAt={groupAvatarUpdatedAt}
        className={className}
      />
    );
  }

  const previewMembers = resolveGroupAvatarMembers({
    group_avatar_preview: groupAvatarPreview,
    members,
  });

  if (previewMembers.length === 0) {
    return (
      <CsdChatAvatar
        token={token}
        name={name}
        seed={conversationId}
        hasAvatar={false}
        className={className}
      />
    );
  }

  const count = Math.min(previewMembers.length, 3);
  const gridClass =
    count === 1
      ? 'csd-chat-group-avatar__grid--1'
      : count === 2
        ? 'csd-chat-group-avatar__grid--2'
        : 'csd-chat-group-avatar__grid--3';

  return (
    <span
      className={`csd-chat-group-avatar ${className}`}
      data-testid="csd-chat-group-avatar"
      aria-hidden
    >
      <span className={`csd-chat-group-avatar__grid ${gridClass}`}>
        {previewMembers.slice(0, 3).map((member) => (
          <span key={member.member_staff_id} className="csd-chat-group-avatar__cell">
            <CsdChatAvatar
              token={token}
              name={member.display_name_vi?.trim() || `Staff #${member.member_staff_id}`}
              seed={member.member_staff_id}
              staffId={member.member_staff_id}
              hasAvatar={member.has_avatar}
              avatarUpdatedAt={member.avatar_updated_at ?? null}
              className="csd-chat-avatar csd-chat-avatar--tile"
            />
          </span>
        ))}
      </span>
    </span>
  );
}

import {
  canManageGroupInfo,
  canLeaveGroup,
  canManageGroupMembers,
  canPinGroupMessage,
  canRemoveGroupMember,
  canResolveJoinRequest,
  canSendInGroup,
  canSetGroupAdminRole,
  canToggleGroupModeration,
  canTransferGroupOwner,
  isAssignableGroupRole,
} from './csd-chat-group-admin.util';

describe('csd-chat-group-admin.util', () => {
  it('lets owner and admin edit group info; members cannot', () => {
    expect(canManageGroupInfo('owner', false)).toBe(true);
    expect(canManageGroupInfo('admin', false)).toBe(true);
    expect(canManageGroupInfo('member', false)).toBe(false);
    expect(canManageGroupInfo('viewer', false)).toBe(false);
    expect(canManageGroupInfo(null, true)).toBe(true);
  });

  it('lets owner and admin manage members', () => {
    expect(canManageGroupMembers('admin', false)).toBe(true);
    expect(canManageGroupMembers('member', false)).toBe(false);
  });

  it('only owner (or platform manage) can set admin role', () => {
    expect(canSetGroupAdminRole('owner', false)).toBe(true);
    expect(canSetGroupAdminRole('admin', false)).toBe(false);
    expect(canSetGroupAdminRole('admin', true)).toBe(true);
  });

  it('enforces remove matrix: cannot remove owner; admin cannot remove admin', () => {
    expect(canRemoveGroupMember('owner', 'owner', false)).toBe(false);
    expect(canRemoveGroupMember('owner', 'admin', false)).toBe(true);
    expect(canRemoveGroupMember('admin', 'member', false)).toBe(true);
    expect(canRemoveGroupMember('admin', 'admin', false)).toBe(false);
    expect(canRemoveGroupMember('member', 'member', false)).toBe(false);
  });

  it('only allows promote/demote to admin|member', () => {
    expect(isAssignableGroupRole('admin')).toBe(true);
    expect(isAssignableGroupRole('member')).toBe(true);
    expect(isAssignableGroupRole('owner')).toBe(false);
    expect(isAssignableGroupRole('viewer')).toBe(false);
  });

  it('Wave B: moderation toggles and join resolve for owner/admin', () => {
    expect(canToggleGroupModeration('admin', false)).toBe(true);
    expect(canToggleGroupModeration('member', false)).toBe(false);
    expect(canResolveJoinRequest('owner', false)).toBe(true);
    expect(canResolveJoinRequest('member', false)).toBe(false);
  });

  it('Wave B: send lock blocks members when members_can_send=false', () => {
    expect(canSendInGroup('member', true, false)).toBe(true);
    expect(canSendInGroup('member', false, false)).toBe(false);
    expect(canSendInGroup('admin', false, false)).toBe(true);
    expect(canSendInGroup('owner', false, false)).toBe(true);
    expect(canSendInGroup('viewer', false, true)).toBe(true);
  });

  it('non-owner members may leave; owner cannot', () => {
    expect(canLeaveGroup('owner')).toBe(false);
    expect(canLeaveGroup('admin')).toBe(true);
    expect(canLeaveGroup('member')).toBe(true);
    expect(canLeaveGroup('viewer')).toBe(true);
    expect(canLeaveGroup(null)).toBe(false);
  });

  it('Wave B: pin for owner/admin; transfer only owner', () => {
    expect(canPinGroupMessage('admin', false)).toBe(true);
    expect(canPinGroupMessage('member', false)).toBe(false);
    expect(canTransferGroupOwner('owner', false)).toBe(true);
    expect(canTransferGroupOwner('admin', false)).toBe(false);
    expect(canTransferGroupOwner('admin', true)).toBe(true);
  });
});

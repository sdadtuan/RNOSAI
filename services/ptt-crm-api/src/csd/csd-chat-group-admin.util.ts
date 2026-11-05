export type CsdGroupMemberRole = 'owner' | 'admin' | 'member' | 'viewer';

export function canManageGroupInfo(
  actorRole: CsdGroupMemberRole | null,
  hasPlatformManage: boolean,
): boolean {
  if (hasPlatformManage) return true;
  return actorRole === 'owner' || actorRole === 'admin';
}

export function canManageGroupMembers(
  actorRole: CsdGroupMemberRole | null,
  hasPlatformManage: boolean,
): boolean {
  return canManageGroupInfo(actorRole, hasPlatformManage);
}

export function canSetGroupAdminRole(
  actorRole: CsdGroupMemberRole | null,
  hasPlatformManage: boolean,
): boolean {
  if (hasPlatformManage) return true;
  return actorRole === 'owner';
}

export function canRemoveGroupMember(
  actorRole: CsdGroupMemberRole | null,
  targetRole: CsdGroupMemberRole,
  hasPlatformManage: boolean,
): boolean {
  if (targetRole === 'owner') return false;
  if (hasPlatformManage) return true;
  if (actorRole === 'owner') {
    return targetRole === 'admin' || targetRole === 'member' || targetRole === 'viewer';
  }
  if (actorRole === 'admin') {
    return targetRole === 'member' || targetRole === 'viewer';
  }
  return false;
}

export function isAssignableGroupRole(role: string): role is 'admin' | 'member' {
  return role === 'admin' || role === 'member';
}

/** Wave B: toggle join approval / send lock */
export function canToggleGroupModeration(
  actorRole: CsdGroupMemberRole | null,
  hasPlatformManage: boolean,
): boolean {
  return canManageGroupInfo(actorRole, hasPlatformManage);
}

export function canResolveJoinRequest(
  actorRole: CsdGroupMemberRole | null,
  hasPlatformManage: boolean,
): boolean {
  return canManageGroupMembers(actorRole, hasPlatformManage);
}

/** When members_can_send is false, only owner/admin (or platform) may send. */
export function canSendInGroup(
  actorRole: CsdGroupMemberRole | null,
  membersCanSend: boolean,
  hasPlatformManage: boolean,
): boolean {
  if (membersCanSend) return true;
  if (hasPlatformManage) return true;
  return actorRole === 'owner' || actorRole === 'admin';
}

export function canPinGroupMessage(
  actorRole: CsdGroupMemberRole | null,
  hasPlatformManage: boolean,
): boolean {
  return canManageGroupInfo(actorRole, hasPlatformManage);
}

export function canTransferGroupOwner(
  actorRole: CsdGroupMemberRole | null,
  hasPlatformManage: boolean,
): boolean {
  if (hasPlatformManage) return true;
  return actorRole === 'owner';
}

/** Any non-owner member may leave the group voluntarily. */
export function canLeaveGroup(actorRole: CsdGroupMemberRole | null): boolean {
  return actorRole != null && actorRole !== 'owner';
}

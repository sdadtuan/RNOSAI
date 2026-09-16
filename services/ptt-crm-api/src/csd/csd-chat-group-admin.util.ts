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

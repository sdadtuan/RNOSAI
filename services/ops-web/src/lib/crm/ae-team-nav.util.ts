import type { StoredStaffUser } from '@/lib/auth';

export function canSeeAeTeamNav(user: StoredStaffUser | null | undefined): boolean {
  return user?.ae_team_access === 'lead' || user?.ae_team_access === 'all';
}

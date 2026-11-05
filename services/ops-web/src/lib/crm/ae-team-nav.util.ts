import type { StoredStaffUser } from '@/lib/auth';

export function canSeeAeTeamNav(user: StoredStaffUser | null | undefined): boolean {
  return user?.ae_team_access === 'lead' || user?.ae_team_access === 'all';
}

function positionCode(user: StoredStaffUser | null | undefined): string {
  return String(user?.position_code ?? '').trim().toLowerCase().replace(/\s+/g, '');
}

/** Account Manager, GDKD, admin, CEO, and AE team leads. */
export function canSeeAePerformanceNav(user: StoredStaffUser | null | undefined): boolean {
  if (canSeeAeTeamNav(user)) return true;
  const code = positionCode(user);
  return (
    code === 'acm' ||
    code === 'kd-01' ||
    code === 'kd01' ||
    code === 'gdkd-01' ||
    code === 'gdkd' ||
    code.startsWith('gdkd-') ||
    code.startsWith('gdkd_') ||
    code === 'ceo' ||
    code.startsWith('ceo-') ||
    code.startsWith('ceo_') ||
    code === 'admin' ||
    code.startsWith('admin-') ||
    code.startsWith('admin_') ||
    code === 'super-admin' ||
    code === 'super_admin'
  );
}

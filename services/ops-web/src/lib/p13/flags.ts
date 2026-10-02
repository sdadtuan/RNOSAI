import { hasCap, type StoredStaffUser } from '@/lib/auth';

export function p13Enabled(user: StoredStaffUser | null): boolean {
  if (user?.feature_flags && typeof user.feature_flags.p13_enabled === 'boolean') {
    return user.feature_flags.p13_enabled;
  }
  const raw = String(process.env.NEXT_PUBLIC_P13_ENABLED ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true';
}

export function canSeeP13Catalog(user: StoredStaffUser | null): boolean {
  if (!p13Enabled(user)) return false;
  return hasCap(user, 'p13_catalog', 'view') || hasCap(user, 'p13_catalog', 'manage');
}

export function canManageP13Catalog(user: StoredStaffUser | null): boolean {
  return p13Enabled(user) && hasCap(user, 'p13_catalog', 'manage');
}

export function canManageP13Holidays(user: StoredStaffUser | null): boolean {
  return p13Enabled(user) && hasCap(user, 'p13_holidays', 'manage');
}

export function canSeeP13Pricing(user: StoredStaffUser | null): boolean {
  return p13Enabled(user) && hasCap(user, 'p13_pricing', 'view');
}

export function canEditP13Pricing(user: StoredStaffUser | null): boolean {
  return p13Enabled(user) && hasCap(user, 'p13_pricing', 'edit_draft');
}

export function canViewP13Cost(user: StoredStaffUser | null): boolean {
  return p13Enabled(user) && hasCap(user, 'p13_pricing', 'cost.view');
}

export function canActivateP13Pricing(user: StoredStaffUser | null): boolean {
  return p13Enabled(user) && hasCap(user, 'p13_pricing', 'activate');
}

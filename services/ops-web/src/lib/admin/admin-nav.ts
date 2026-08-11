import { hasCap, type StoredStaffUser } from '@/lib/auth';
import {
  winFieldAbacEnabled,
  winOrgUiEnabled,
  winPermissionSetsEnabled,
  winSimulatorEnabled,
  winSsoEnabled,
} from '@/lib/win/flags';
import type { ModuleNavLink } from './module-nav';

export function canViewAdminSection(user: StoredStaffUser | null): boolean {
  if (!user) return false;
  return (
    hasCap(user, 'crm_data_config', 'view') ||
    hasCap(user, 'crm_staff_departments', 'view') ||
    hasCap(user, 'crm_staff_roster', 'view') ||
    hasCap(user, 'ai_admin', 'view')
  );
}

function canViewOrgAdmin(user: StoredStaffUser): boolean {
  if (!winOrgUiEnabled()) return false;
  return (
    hasCap(user, 'crm_staff_departments', 'view') ||
    hasCap(user, 'crm_staff_roster', 'view') ||
    hasCap(user, 'crm_data_config', 'view')
  );
}

export function buildAdminSidebarLinks(user: StoredStaffUser | null): ModuleNavLink[] {
  if (!user || !canViewAdminSection(user)) return [];

  const links: ModuleNavLink[] = [];

  if (hasCap(user, 'crm_data_config', 'view')) {
    links.push(
      { href: '/admin/crm/custom-fields', label: 'Custom fields' },
      { href: '/admin/crm/pipeline', label: 'Pipeline sales' },
      { href: '/admin/crm/lead-lookups', label: 'Nguồn & Kênh' },
      { href: '/admin/crm/permissions', label: 'Ma trận chức vụ' },
      { href: '/admin/crm/permissions/functions', label: 'Job function' },
      { href: '/admin/crm/permissions/users', label: 'Gán user' },
    );
    if (winPermissionSetsEnabled()) {
      links.push({ href: '/admin/crm/permission-sets', label: 'Permission Sets' });
    }
    if (winSimulatorEnabled()) {
      links.push({ href: '/admin/crm/permissions/simulator', label: 'Simulator' });
    }
    if (winFieldAbacEnabled()) {
      links.push({ href: '/admin/crm/permissions/fields', label: 'Field ABAC' });
    }
    if (winSsoEnabled()) {
      links.push({ href: '/admin/crm/sso/groups', label: 'SSO groups' });
    }
  }

  if (canViewOrgAdmin(user)) {
    links.push(
      { href: '/admin/crm/org/users', label: 'Người dùng' },
      { href: '/admin/crm/org/users/new', label: '+ Onboard NV' },
      { href: '/admin/crm/org/departments', label: 'Phòng ban' },
      { href: '/admin/crm/org/teams', label: 'Team' },
      { href: '/admin/crm/org/positions', label: 'Chức vụ (HR)' },
      { href: '/admin/crm/org/chart', label: 'Sơ đồ tổ chức' },
    );
  }

  if (hasCap(user, 'ai_admin', 'view')) {
    links.push(
      { href: '/admin/ai/agents', label: 'AI Agents' },
      { href: '/admin/ai/tools', label: 'AI Tools' },
      { href: '/admin/ai/runs', label: 'AI Runs' },
    );
  }

  return links;
}

/** Subset for AdminPageShell module subnav (data + permissions entry). */
export function buildCrmConfigModuleLinksFromAdminNav(
  user: StoredStaffUser | null,
): ModuleNavLink[] {
  if (!user || !hasCap(user, 'crm_data_config', 'view')) return [];
  return buildAdminSidebarLinks(user).filter(
    (l) =>
      l.href.startsWith('/admin/crm/custom-fields') ||
      l.href.startsWith('/admin/crm/pipeline') ||
      l.href.startsWith('/admin/crm/lead-lookups') ||
      l.href.startsWith('/admin/crm/permissions') ||
      l.href.startsWith('/admin/crm/permission-sets'),
  );
}

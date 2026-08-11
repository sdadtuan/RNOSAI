import { describe, expect, it } from 'vitest';
import { buildAdminSidebarLinks, canViewAdminSection } from './admin-nav';
import type { StoredStaffUser } from '@/lib/auth';

function adminUser(overrides: Partial<StoredStaffUser> = {}): StoredStaffUser {
  return {
    id: 'u1',
    email: 'admin@pttads.vn',
    display_name: 'Admin',
    position_id: 1,
    position_code: 'super-admin',
    job_functions: [],
    caps: [
      { section: 'crm_data_config', action: 'view' },
      { section: 'crm_staff_roster', action: 'view' },
      { section: 'ai_admin', action: 'view' },
    ],
    ...overrides,
  };
}

describe('admin-nav', () => {
  it('canViewAdminSection true when any admin cap', () => {
    expect(canViewAdminSection(adminUser())).toBe(true);
    expect(canViewAdminSection(null)).toBe(false);
  });

  it('includes org users link when roster view + WIN_ORG_UI', () => {
    const prev = process.env.NEXT_PUBLIC_WIN_ORG_UI;
    process.env.NEXT_PUBLIC_WIN_ORG_UI = '1';
    const links = buildAdminSidebarLinks(adminUser());
    expect(links.some((l) => l.href === '/admin/crm/org/users')).toBe(true);
    process.env.NEXT_PUBLIC_WIN_ORG_UI = prev;
  });

  it('includes permissions when crm_data_config.view', () => {
    const links = buildAdminSidebarLinks(adminUser());
    expect(links.some((l) => l.href === '/admin/crm/permissions')).toBe(true);
  });

  it('includes AI links when ai_admin.view', () => {
    const links = buildAdminSidebarLinks(adminUser());
    expect(links.some((l) => l.href === '/admin/ai/agents')).toBe(true);
  });

  it('empty for user without admin caps', () => {
    const user = adminUser({
      caps: [{ section: 'crm_leads', action: 'view' }],
    });
    expect(canViewAdminSection(user)).toBe(false);
    expect(buildAdminSidebarLinks(user)).toEqual([]);
  });
});

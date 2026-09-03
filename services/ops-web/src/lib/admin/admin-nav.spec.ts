import { describe, expect, it } from 'vitest';
import {
  buildAdminHubWorkspaces,
  buildAdminNavGroups,
  buildAdminSidebarLinks,
  canViewAdminSection,
} from './admin-nav';
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

  it('sidebar exposes single hub link', () => {
    expect(buildAdminSidebarLinks(adminUser())).toEqual([
      { href: '/admin', label: 'Trung tâm quản trị' },
    ]);
  });

  it('nav groups include org users when roster view + WIN_ORG_UI', () => {
    const prev = process.env.NEXT_PUBLIC_WIN_ORG_UI;
    process.env.NEXT_PUBLIC_WIN_ORG_UI = '1';
    const groups = buildAdminNavGroups(adminUser());
    const org = groups.find((g) => g.id === 'org');
    expect(org?.links.some((l) => l.href === '/admin/crm/org/users')).toBe(true);
    process.env.NEXT_PUBLIC_WIN_ORG_UI = prev;
  });

  it('nav groups include permissions when crm_data_config.view', () => {
    const groups = buildAdminNavGroups(adminUser());
    const rbac = groups.find((g) => g.id === 'rbac');
    expect(rbac?.links.some((l) => l.href === '/admin/crm/permissions')).toBe(true);
  });

  it('hub workspaces include AI when ai_admin.view', () => {
    const workspaces = buildAdminHubWorkspaces(adminUser());
    expect(workspaces.some((w) => w.id === 'ai')).toBe(true);
  });

  it('shows Video SOP providers when crm_vd.admin or ai_admin view', () => {
    const href = '/admin/video/providers';
    const ai = adminUser({ caps: [{ section: 'ai_admin', action: 'view' }] });
    const vd = adminUser({ caps: [{ section: 'crm_vd.admin', action: 'view' }] });
    expect(buildAdminNavGroups(ai).find((g) => g.id === 'ai')?.links.some((l) => l.href === href)).toBe(
      true,
    );
    expect(buildAdminNavGroups(vd).find((g) => g.id === 'ai')?.links.some((l) => l.href === href)).toBe(
      true,
    );
    expect(canViewAdminSection(vd)).toBe(true);
  });

  it('data group includes brand page', () => {
    const groups = buildAdminNavGroups(adminUser());
    const data = groups.find((g) => g.id === 'data');
    expect(data?.links.some((l) => l.href === '/admin/brand' && l.label === 'Hình ảnh & logo')).toBe(
      true,
    );
  });

  it('kpi setup links include KPI Hub when crm_kpi_hub.view', () => {
    const groups = buildAdminNavGroups(
      adminUser({ caps: [{ section: 'crm_kpi_hub', action: 'view' }] }),
    );
    const kpi = groups.find((g) => g.id === 'kpi');
    expect(kpi?.links.some((l) => l.href === '/crm/kpi-hub' && l.label === 'KPI Hub')).toBe(true);
  });

  it('empty for user without admin caps', () => {
    const user = adminUser({
      caps: [{ section: 'crm_leads', action: 'view' }],
    });
    expect(canViewAdminSection(user)).toBe(false);
    expect(buildAdminSidebarLinks(user)).toEqual([]);
    expect(buildAdminNavGroups(user)).toEqual([]);
  });

  it('sidebar includes chat accounts when csd.admin', () => {
    const user = adminUser({ caps: [{ section: 'csd', action: 'admin' }] });
    expect(canViewAdminSection(user)).toBe(true);
    expect(buildAdminSidebarLinks(user)).toEqual([
      { href: '/admin', label: 'Trung tâm quản trị' },
      { href: '/admin/crm/csd/chat-accounts', label: 'Tài khoản Chat' },
    ]);
  });

  it('sidebar includes Kho Sales Kit for configure cap without full admin', () => {
    const gdkd = adminUser({
      caps: [{ section: 'crm_leads', action: 'configure' }],
    });
    expect(canViewAdminSection(gdkd)).toBe(false);
    expect(buildAdminSidebarLinks(gdkd)).toEqual([
      { href: '/crm/intake/sales-kit', label: 'Kho Sales Kit' },
    ]);
  });

  it('ai nav group includes Kho Sales Kit when configure cap', () => {
    const user = adminUser({
      caps: [
        { section: 'crm_data_config', action: 'view' },
        { section: 'playbooks', action: 'configure' },
      ],
    });
    const ai = buildAdminNavGroups(user).find((g) => g.id === 'ai');
    expect(ai?.links.some((l) => l.href === '/crm/intake/sales-kit')).toBe(true);
  });

  it('kpi setup group links to Nhóm KPI when crm_kpi_groups.view', () => {
    const user = adminUser({ caps: [{ section: 'crm_kpi_groups', action: 'view' }] });
    expect(canViewAdminSection(user)).toBe(true);
    const kpi = buildAdminNavGroups(user).find((g) => g.id === 'kpi');
    expect(kpi?.label).toBe('Thiết lập KPI');
    expect(kpi?.links).toEqual([{ href: '/crm/kpi/groups', label: 'Nhóm KPI' }]);
    expect(buildAdminSidebarLinks(user)).toEqual([
      { href: '/admin', label: 'Trung tâm quản trị' },
      { href: '/crm/kpi/groups', label: 'Thiết lập KPI' },
    ]);
  });

  it('kpi setup group includes KPI Type when crm_kpi_types.view', () => {
    const user = adminUser({
      caps: [
        { section: 'crm_kpi_groups', action: 'view' },
        { section: 'crm_kpi_types', action: 'view' },
      ],
    });
    const kpi = buildAdminNavGroups(user).find((g) => g.id === 'kpi');
    expect(kpi?.links).toEqual([
      { href: '/crm/kpi/groups', label: 'Nhóm KPI' },
      { href: '/crm/kpi/types', label: 'KPI Type' },
    ]);
    expect(buildAdminSidebarLinks(user)).toEqual([
      { href: '/admin', label: 'Trung tâm quản trị' },
      { href: '/crm/kpi/groups', label: 'Thiết lập KPI' },
    ]);
  });

  it('kpi setup group includes KPI Hub when crm_kpi_hub.view', () => {
    const user = adminUser({ caps: [{ section: 'crm_kpi_hub', action: 'view' }] });
    const kpi = buildAdminNavGroups(user).find((g) => g.id === 'kpi');
    expect(kpi?.links).toEqual([{ href: '/crm/kpi-hub', label: 'KPI Hub' }]);
  });
});

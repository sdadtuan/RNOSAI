import { describe, expect, it } from 'vitest';
import { buildNavTree, collapseThinParents, collectHrefs } from './ops-nav-tree';
import type { StoredStaffUser } from '@/lib/auth';

function cap(section: string, action: string) {
  return { section, action };
}

/** Broad caps so most parents appear (flags may still hide some). */
function superUser(): StoredStaffUser {
  const sections = [
    'crm_am',
    'crm_board',
    'crm_leads',
    'crm_presales_solution',
    'crm_sales_overview',
    'crm_sales_plans',
    'crm_agency',
    'crm_b2b_projects',
    'crm_board_customers',
    'crm_re_projects',
    'crm_research',
    'crm_kpi_hub',
    'crm_kpi_dictionary',
    'crm_kpi_hub_targets',
    'crm_kpi_hub_sources',
    'crm_kpi_quality',
    'crm_kpi_hub_reports',
    'crm_kpi_hub_settings',
    'crm_kpi_records',
    'crm_kpi_groups',
    'crm_kpi_types',
    'crm_staff_roster',
    'crm_staff_kpi_am_sp',
    'crm_payroll_salary',
    'crm_payroll_attendance',
    'crm_business_dashboard',
    'crm_owner_weekly_dashboard',
    'crm_facebook_ads',
    'crm_google_ads',
    'crm_zalo_ads',
    'crm_email_mkt',
    'crm_content',
    'crm_seo_aeo',
    'csd',
    'iwr',
    'automation_workflows',
    'playbooks',
    'crm_data_config',
    'crm_quote',
    'ceo_command',
    'ai_analytics',
  ];
  const actions = ['view', 'edit', 'create', 'manage', 'assign', 'write', 'configure', 'query', 'admin'];
  const caps: Array<{ section: string; action: string }> = [];
  for (const s of sections) {
    for (const a of actions) caps.push(cap(s, a));
  }
  return {
    id: '1',
    email: 'a@pttads.vn',
    display_name: 'Admin',
    position_id: 1,
    caps,
  };
}

describe('collapseThinParents', () => {
  it('collapses single-child parents to leaves', () => {
    const collapsed = collapseThinParents([
      {
        kind: 'parent',
        id: 'am',
        label: 'Account Management',
        icon: 'customers',
        children: [
          { id: 'am-hub', label: 'Trung tâm AM', href: '/crm/account-management', icon: 'customers' },
        ],
      },
    ]);
    expect(collapsed[0]).toMatchObject({
      kind: 'leaf',
      id: 'am',
      href: '/crm/account-management',
      label: 'Account Management',
    });
  });
});

describe('buildNavTree IA', () => {
  it('orders top-level ids per spec', () => {
    const prev: Record<string, string | undefined> = {};
    const flags = [
      'NEXT_PUBLIC_SEO_HUB',
      'NEXT_PUBLIC_EMAIL_MODULE',
      'NEXT_PUBLIC_CONTENT_MARKETING',
      'NEXT_PUBLIC_MARKET_RESEARCH',
      'NEXT_PUBLIC_CEO_COMMAND',
      'NEXT_PUBLIC_REVOPS_SHELL',
    ];
    for (const f of flags) {
      prev[f] = process.env[f];
      process.env[f] = '1';
    }
    try {
      const ids = buildNavTree(superUser(), { imageSopEnabled: true }).map((i) => i.id);
      expect(ids.indexOf('overview')).toBeLessThan(ids.indexOf('sales'));
      expect(ids.indexOf('sales')).toBeLessThan(ids.indexOf('crm'));
      expect(ids.indexOf('csd')).toBeGreaterThan(-1);
      expect(ids.indexOf('ads')).toBeLessThan(ids.indexOf('seo') === -1 ? 999 : ids.indexOf('seo'));
      expect(ids.indexOf('finance')).toBeGreaterThan(-1);
    } finally {
      for (const f of flags) {
        if (prev[f] === undefined) delete process.env[f];
        else process.env[f] = prev[f];
      }
    }
  });

  it('uses Vietnamese child labels from spec', () => {
    const sales = buildNavTree(superUser(), {}).find((i) => i.id === 'sales');
    expect(sales?.kind).toBe('parent');
    if (sales?.kind === 'parent') {
      const labels = sales.children.map((c) => c.label);
      expect(labels).toContain('Hàng đợi Solution');
      expect(labels).toContain('Hub hợp đồng');
    }
  });

  it('keeps critical hrefs reachable for super-like user', () => {
    const prevEmail = process.env.NEXT_PUBLIC_EMAIL_MODULE;
    process.env.NEXT_PUBLIC_EMAIL_MODULE = '1';
    try {
      const hrefs = collectHrefs(buildNavTree(superUser(), { imageSopEnabled: true }));
      for (const h of [
        '/',
        '/crm/b2b/leads',
        '/crm/csd/chat',
        '/crm/account-management',
        '/agency',
        '/email/hub',
        '/crm/kpi-hub',
        '/crm/internal-reports',
      ]) {
        expect(hrefs).toContain(h);
      }
    } finally {
      if (prevEmail === undefined) delete process.env.NEXT_PUBLIC_EMAIL_MODULE;
      else process.env.NEXT_PUBLIC_EMAIL_MODULE = prevEmail;
    }
  });

  it('AE matrix seed does not open Ads/SEO/Email/Plan/Finance via agency.view', () => {
    const prev: Record<string, string | undefined> = {};
    for (const f of ['NEXT_PUBLIC_SEO_HUB', 'NEXT_PUBLIC_EMAIL_MODULE', 'NEXT_PUBLIC_MARKET_RESEARCH']) {
      prev[f] = process.env[f];
      process.env[f] = '1';
    }
    try {
      const ae: StoredStaffUser = {
        id: 'ae-1',
        email: 'ae@pttads.vn',
        display_name: 'AE',
        position_id: 3,
        caps: [
          { section: 'crm_agency', action: 'view' },
          { section: 'crm_leads', action: 'view' },
          { section: 'crm_leads', action: 'edit' },
          { section: 'crm_b2b_projects', action: 'view' },
          { section: 'csd', action: 'view' },
          { section: 'csd', action: 'write' },
          { section: 'crm_quote', action: 'view' },
          { section: 'crm_hdsd', action: 'view' },
        ],
      };
      const ids = buildNavTree(ae, {}).map((i) => i.id);
      expect(ids).toContain('agency');
      expect(ids).not.toContain('ads');
      expect(ids).not.toContain('seo');
      expect(ids).not.toContain('email');
      expect(ids).not.toContain('plan');
      expect(ids).not.toContain('finance');
    } finally {
      for (const [f, v] of Object.entries(prev)) {
        if (v === undefined) delete process.env[f];
        else process.env[f] = v;
      }
    }
  });
});

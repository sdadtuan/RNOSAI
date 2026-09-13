import { readFileSync } from 'fs';
import { join } from 'path';

const CATALOG_PATH = join(__dirname, 'rbac-admin-catalog.json');
const SEED_SCRIPT_PATH = join(__dirname, '../../../../scripts/seed_qt_rbac.sh');

const CRM_QUOTE_SECTIONS = [
  'crm_quote',
  'crm_quote.approve',
  'crm_quote.finance',
  'crm_quote.legal',
  'crm_quote.publish',
  'crm_quote.convert',
  'crm_quote.catalog',
  'crm_quote.audit',
] as const;

const CRM_CONTENT_ACTIONS = [
  'admin',
  'approve_internal',
  'assign',
  'generate',
  'production',
  'publish',
  'qa',
  'view',
  'write',
] as const;

describe('rbac-admin-catalog — crm_content (Content Marketing OS)', () => {
  it('defines crm_content in catalog with Content OS hub page', () => {
    const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8')) as {
      section_actions: Record<string, string[]>;
      permission_ids: string[];
      sections: Array<{ id: string; label: string; page: string }>;
    };

    expect(catalog.section_actions.crm_content).toEqual([...CRM_CONTENT_ACTIONS]);
    expect(catalog.permission_ids).toContain('crm_content');
    const section = catalog.sections.find((s) => s.id === 'crm_content');
    expect(section?.label).toBe('Content Marketing OS');
    expect(section?.page).toBe('/crm/content-os');
  });
});

const CORE_DELIVERY_SECTIONS = [
  'crm_board',
  'iwr',
  'crm_b2b_projects',
  'playbooks',
  'ai_analytics',
  'ai_forecast',
  'admin_scope',
  'admin_change',
  'crm_lmp',
] as const;

describe('rbac-admin-catalog — delivery & org gaps', () => {
  it('defines core missing sections in section_actions and permission_ids', () => {
    const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8')) as {
      section_actions: Record<string, string[]>;
      permission_ids: string[];
      sections: Array<{ id: string }>;
    };

    for (const id of CORE_DELIVERY_SECTIONS) {
      expect(catalog.section_actions[id]).toBeDefined();
      expect(catalog.permission_ids).toContain(id);
      expect(catalog.sections.some((s) => s.id === id)).toBe(true);
    }
  });
});

const MSOS_CHILD_SECTIONS = [
  'crm_media.inventory',
  'crm_media.packages',
  'crm_media.campaigns',
  'crm_media.evidence',
  'crm_media.outcomes',
  'crm_media.margin',
  'crm_media.settings',
] as const;

const REVOPS_CHILD_SECTIONS = [
  'crm_revops.pipeline',
  'crm_revops.sla',
  'crm_revops.reports',
  'crm_revops.territory',
  'crm_revops.approvals',
  'crm_revops.settings',
] as const;

const AM_CHILD_SECTIONS = [
  'crm_am.clients',
  'crm_am.onboarding',
  'crm_am.work',
  'crm_am.renewals',
  'crm_am.health',
  'crm_am.reports',
  'crm_am.opportunities',
  'crm_am.feedback',
  'crm_am.settings',
] as const;

const AD_PLATFORM_SECTIONS = ['meta_ads_ops', 'meta_campaign_write', 'crm_zalo_ads'] as const;

describe('rbac-admin-catalog — phase 2 sub-sections & ad caps', () => {
  it('defines Media/RevOps/AM child sections and ad platform caps', () => {
    const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8')) as {
      section_actions: Record<string, string[]>;
      permission_ids: string[];
      sections: Array<{ id: string }>;
      extra_actions: string[];
    };

    for (const id of [...MSOS_CHILD_SECTIONS, ...REVOPS_CHILD_SECTIONS, ...AM_CHILD_SECTIONS, ...AD_PLATFORM_SECTIONS]) {
      expect(catalog.section_actions[id]).toBeDefined();
      expect(catalog.permission_ids).toContain(id);
      expect(catalog.sections.some((s) => s.id === id)).toBe(true);
    }

    expect(catalog.section_actions.meta_ads_ops).toEqual(['view', 'submit']);
    expect(catalog.section_actions.meta_campaign_write).toEqual(['view', 'approve']);
    expect(catalog.section_actions.crm_zalo_ads).toEqual(['view', 'edit', 'export']);
    expect(catalog.extra_actions).toContain('submit');
  });
});

describe('rbac-admin-catalog — crm_quote (Quotation OS)', () => {
  it('parses rbac-admin-catalog.json', () => {
    expect(() => JSON.parse(readFileSync(CATALOG_PATH, 'utf8'))).not.toThrow();
  });

  it('defines all 8 crm_quote section ids in section_actions and permission_ids', () => {
    const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8')) as {
      section_actions: Record<string, string[]>;
      permission_ids: string[];
      sections: Array<{ id: string }>;
    };

    for (const id of CRM_QUOTE_SECTIONS) {
      expect(catalog.section_actions[id]).toBeDefined();
      expect(catalog.permission_ids).toContain(id);
      expect(catalog.sections.some((s) => s.id === id)).toBe(true);
    }
  });

  it('seed_qt_rbac.sh has FORBIDDEN comment and no executable staff_section_permissions INSERT', () => {
    const script = readFileSync(SEED_SCRIPT_PATH, 'utf8');
    expect(script).toContain('# FORBIDDEN: INSERT INTO staff_section_permissions');
    expect(script).not.toMatch(/^\s*INSERT\s+INTO\s+staff_section_permissions/im);
  });
});

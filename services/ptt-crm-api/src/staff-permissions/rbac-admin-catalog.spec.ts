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

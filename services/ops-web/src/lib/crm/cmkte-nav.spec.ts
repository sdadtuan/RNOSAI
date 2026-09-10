import { describe, expect, it } from 'vitest';
import { CMKTE_NAV, resolveCmktEWorkspaceHref } from './cmkte-nav';

describe('CMKTE_NAV', () => {
  it('locks 8 labels, glyphs, and hrefs from the mockup contract', () => {
    expect(CMKTE_NAV).toHaveLength(8);
    expect(CMKTE_NAV.map((item) => item.screen)).toEqual([
      'command',
      'requests',
      'workspace',
      'approvals',
      'calendar',
      'library',
      'intelligence',
      'settings',
    ]);
    expect(CMKTE_NAV.map((item) => item.label)).toEqual([
      'Command Center',
      'Content Requests',
      'Production Workspace',
      'Approval Center',
      'Publication Control',
      'Brand & Asset Library',
      'Content Intelligence',
      'Governance Settings',
    ]);
    expect(CMKTE_NAV.map((item) => item.glyph)).toEqual([
      '▦',
      '◉',
      '✦',
      '✓',
      '□',
      '▣',
      '◌',
      '⚙',
    ]);
    expect(CMKTE_NAV.map((item) => item.href)).toEqual([
      '/crm/content-os',
      '/crm/content-os/requests',
      '/crm/content-os/w/0',
      '/crm/content-os/approvals',
      '/crm/content-os/calendar',
      '/crm/content-os/library',
      '/crm/content-os/intelligence',
      '/crm/content-os/settings',
    ]);
  });
});

describe('resolveCmktEWorkspaceHref', () => {
  it('rewrites only a positive numeric last-item id', () => {
    expect(resolveCmktEWorkspaceHref('21')).toBe('/crm/content-os/w/21');
    expect(resolveCmktEWorkspaceHref('0')).toBe('/crm/content-os/w/0');
    expect(resolveCmktEWorkspaceHref('-3')).toBe('/crm/content-os/w/0');
    expect(resolveCmktEWorkspaceHref('CNT-260910-021')).toBe('/crm/content-os/w/0');
    expect(resolveCmktEWorkspaceHref(null)).toBe('/crm/content-os/w/0');
  });
});

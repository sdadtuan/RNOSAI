import { describe, expect, it } from 'vitest';
import {
  VD_SOP_NAV,
  resolveVdWorkspaceHref,
  resolveVdGateHref,
  resolveVdLibraryHref,
} from './video-sop-nav';

describe('video-sop-nav', () => {
  it('exposes seven nav items with required screens', () => {
    expect(VD_SOP_NAV.map((n) => n.screen)).toEqual([
      'command',
      'projects',
      'workspace',
      'gates',
      'dashboard',
      'library',
      'admin',
    ]);
  });

  it('resolves last project hrefs or falls back to command', () => {
    expect(resolveVdWorkspaceHref('3')).toBe('/crm/video/3');
    expect(resolveVdGateHref('3')).toBe('/crm/video/3/gates/1');
    expect(resolveVdLibraryHref('3')).toBe('/crm/video/3/library');
    expect(resolveVdWorkspaceHref(null)).toBe('/crm/video');
    expect(resolveVdGateHref('0')).toBe('/crm/video');
  });
});

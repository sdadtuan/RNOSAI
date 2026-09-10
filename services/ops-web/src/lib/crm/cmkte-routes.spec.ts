import { describe, expect, it } from 'vitest';
import { cmktePath, contentOsPanelHref, legacyContentOsRedirect, resolveServiceDeliveryContentOsTab } from './cmkte-routes';

describe('cmktePath', () => {
  it('builds COS routes', () => {
    expect(cmktePath('command')).toBe('/crm/content-os');
    expect(cmktePath('requests')).toBe('/crm/content-os/requests');
    expect(cmktePath('workspace', 21)).toBe('/crm/content-os/w/21');
    expect(cmktePath('approvals')).toBe('/crm/content-os/approvals');
    expect(cmktePath('calendar')).toBe('/crm/content-os/calendar');
    expect(cmktePath('library')).toBe('/crm/content-os/library');
    expect(cmktePath('intelligence')).toBe('/crm/content-os/intelligence');
    expect(cmktePath('settings')).toBe('/crm/content-os/settings');
  });
});

describe('legacyContentOsRedirect', () => {
  it('maps old board tab to COS filter', () => {
    expect(legacyContentOsRedirect(9)).toBe('/crm/content-os?lifecycle=9');
  });
});

describe('contentOsPanelHref', () => {
  it('deep-links the CMKT editor without making it COS IA', () => {
    expect(contentOsPanelHref(9)).toBe('/crm/service-delivery/9?tab=content-os-panel');
  });
});

describe('resolveServiceDeliveryContentOsTab', () => {
  it('keeps content-os as COS shell and content-os-panel as the editor', () => {
    expect(resolveServiceDeliveryContentOsTab('content-os')).toBe('cos-shell');
    expect(resolveServiceDeliveryContentOsTab('content-os-panel')).toBe('panel');
    expect(resolveServiceDeliveryContentOsTab('workflow')).toBeNull();
  });
});

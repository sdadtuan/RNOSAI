import { describe, expect, it } from 'vitest';
import { RS_MOBILE_TABS, rsMobileTabId, showRsMobileChrome } from './rs-mobile-shell';

describe('showRsMobileChrome', () => {
  it('is on for a narrow staff page', () => {
    expect(showRsMobileChrome({ width: 390, search: '' })).toBe(true);
    expect(showRsMobileChrome({ width: 767, search: '' })).toBe(true);
  });

  it('is off from 768px up', () => {
    expect(showRsMobileChrome({ width: 768, search: '' })).toBe(false);
    expect(showRsMobileChrome({ width: 1280, search: '' })).toBe(false);
  });

  it('stays off for the chat store app and the desktop window', () => {
    expect(showRsMobileChrome({ width: 390, search: '?shell=native' })).toBe(false);
    expect(showRsMobileChrome({ width: 390, search: '?shell=desktop' })).toBe(false);
    expect(showRsMobileChrome({ width: 390, search: '?shell=native&c=1' })).toBe(false);
    expect(showRsMobileChrome({ width: 390, search: 'shell=desktop' })).toBe(false);
  });

  it('stays on for the lead PWA query on a phone', () => {
    expect(showRsMobileChrome({ width: 390, search: '?shell=pwa' })).toBe(true);
  });
});

describe('rsMobileTabId', () => {
  it('matches the four daily routes and their detail pages', () => {
    expect(rsMobileTabId('/crm/leads')).toBe('leads');
    expect(rsMobileTabId('/crm/leads/abc')).toBe('leads');
    expect(rsMobileTabId('/crm/cskh-board')).toBe('cskh');
    expect(rsMobileTabId('/crm/csd/chat')).toBe('chat');
    expect(rsMobileTabId('/crm/csd/tickets')).toBe('tickets');
    expect(rsMobileTabId('/crm/csd/tickets/abc')).toBe('tickets');
  });

  it('does not treat a longer sibling path as the lead tab', () => {
    expect(rsMobileTabId('/crm/leads-archive')).toBeNull();
    expect(rsMobileTabId('/crm/kpi')).toBeNull();
    expect(rsMobileTabId('/crm/csd/tickets-old')).toBeNull();
  });
});

describe('RS_MOBILE_TABS', () => {
  it('lists Lead, CSKH, Chat, Ticket in that order', () => {
    expect(RS_MOBILE_TABS.map((tab) => tab.label)).toEqual(['Lead', 'CSKH', 'Chat', 'Ticket']);
    expect(RS_MOBILE_TABS.map((tab) => tab.href)).toEqual([
      '/crm/leads',
      '/crm/cskh-board',
      '/crm/csd/chat',
      '/crm/csd/tickets',
    ]);
    expect(RS_MOBILE_TABS.map((tab) => tab.id)).toEqual(['leads', 'cskh', 'chat', 'tickets']);
  });

  it('uses the same hrefs as rsMobileTabId', () => {
    for (const tab of RS_MOBILE_TABS) {
      expect(rsMobileTabId(tab.href)).toBe(tab.id);
      expect(rsMobileTabId(`${tab.href}/abc`)).toBe(tab.id);
    }
  });
});

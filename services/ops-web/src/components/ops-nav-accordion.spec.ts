import { describe, expect, it } from 'vitest';
import {
  ensureActiveParentOpen,
  isActiveHref,
  nextOpenIdsAfterToggle,
  type NavItem,
} from './ops-nav-accordion';

const items: NavItem[] = [
  { kind: 'leaf', id: 'overview', label: 'Tổng quan', href: '/', icon: 'home' },
  {
    kind: 'parent',
    id: 'sales',
    label: 'Bán hàng',
    icon: 'sales',
    children: [
      { id: 'b2b', label: 'Lead B2B', href: '/crm/b2b/leads', icon: 'leads' },
      { id: 'inbox', label: 'Inbox B2B', href: '/crm/b2b-inbox', icon: 'inbox' },
    ],
  },
  {
    kind: 'parent',
    id: 'csd',
    label: 'Service Desk',
    icon: 'ticket',
    children: [
      { id: 'csd-home', label: 'Tổng quan', href: '/crm/csd', icon: 'hub' },
      { id: 'chat', label: 'Chat nội bộ', href: '/crm/csd/chat', icon: 'chat' },
    ],
  },
];

describe('isActiveHref', () => {
  it('matches exact and nested paths (same semantics as OpsNav isActive)', () => {
    expect(isActiveHref('/crm/csd/chat', '/crm/csd/chat')).toBe(true);
    expect(isActiveHref('/crm/csd/chat', '/crm/csd')).toBe(true);
    expect(isActiveHref('/crm/b2b/leads/123', '/crm/b2b/leads')).toBe(true);
    expect(isActiveHref('/crm', '/')).toBe(false);
  });
});

describe('nextOpenIdsAfterToggle', () => {
  it('opens one parent and closes others except active pathname parent', () => {
    const open = nextOpenIdsAfterToggle({
      openIds: ['csd'],
      toggledId: 'sales',
      items,
      pathname: '/crm/csd/chat',
    });
    expect(open.sort()).toEqual(['csd', 'sales'].sort());
  });

  it('closes parent when toggled while open', () => {
    const open = nextOpenIdsAfterToggle({
      openIds: ['sales'],
      toggledId: 'sales',
      items,
      pathname: '/',
    });
    expect(open).toEqual([]);
  });
});

describe('ensureActiveParentOpen', () => {
  it('forces parent of active route open', () => {
    expect(ensureActiveParentOpen([], items, '/crm/b2b/leads')).toEqual(['sales']);
  });
});

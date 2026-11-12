import { describe, it, expect } from 'vitest';
import {
  EMPTY_LEAD_FILTERS,
  filterLeadRows,
  findLinkedConversation,
  leadKanbanDropAction,
  leadTagColor,
  uniqueLeadTags,
  type LeadTableRow,
} from './portal-leads-table.util';

function row(partial: Partial<LeadTableRow> & { id: string }): LeadTableRow {
  return {
    title: 'Lead',
    page_id: 'p1',
    status: 'waiting_receive',
    assignee_user_id: null,
    assignee_email: '',
    customer_id: null,
    created_at: '2026-11-01T00:00:00Z',
    ...partial,
  };
}

describe('leadKanbanDropAction — preserves existing CRM PTT transitions', () => {
  it('maps waiting_receive → received to receive', () => {
    expect(leadKanbanDropAction('waiting_receive', 'received')).toEqual({ ok: true, action: 'receive' });
  });

  it('maps waiting_receive or received → caring to care', () => {
    expect(leadKanbanDropAction('waiting_receive', 'caring')).toEqual({ ok: true, action: 'care' });
    expect(leadKanbanDropAction('received', 'caring')).toEqual({ ok: true, action: 'care' });
  });

  it('rejects backward, purchased, and drag-to-purchased (no new transitions)', () => {
    expect(leadKanbanDropAction('received', 'waiting_receive').ok).toBe(false);
    expect(leadKanbanDropAction('caring', 'received').ok).toBe(false);
    expect(leadKanbanDropAction('purchased', 'caring').reason).toBe('already_purchased');
    expect(leadKanbanDropAction('caring', 'purchased').reason).toBe('invalid_transition');
    expect(leadKanbanDropAction('received', 'received').reason).toBe('same');
  });
});

describe('filterLeadRows tag', () => {
  const rows = [
    row({ id: 'a', labels: ['Nóng', 'VIP'] }),
    row({ id: 'b', labels: ['VIP'] }),
    row({ id: 'c', labels: [] }),
  ];
  const pages = new Map([['p1', 'Page']]);

  it('filters by tag and leaves other filters unchanged when tag is empty', () => {
    expect(filterLeadRows(rows, { ...EMPTY_LEAD_FILTERS, tag: 'Nóng' }, pages).map((r) => r.id)).toEqual(['a']);
    expect(filterLeadRows(rows, { ...EMPTY_LEAD_FILTERS, tag: 'VIP' }, pages).map((r) => r.id)).toEqual(['a', 'b']);
    expect(filterLeadRows(rows, EMPTY_LEAD_FILTERS, pages)).toHaveLength(3);
  });
});

describe('uniqueLeadTags / leadTagColor / findLinkedConversation', () => {
  it('collects unique tags and prefers catalog color', () => {
    expect(uniqueLeadTags([row({ id: 'a', labels: ['B', 'A'] }), row({ id: 'b', labels: ['A'] })])).toEqual(['A', 'B']);
    expect(leadTagColor('VIP', [{ name: 'VIP', color: 'ef4444' }])).toBe('#ef4444');
    expect(leadTagColor('VIP', [{ name: 'VIP', color: '#0d9488' }])).toBe('#0d9488');
  });

  it('links a conversation by phone on the same page, or by inbox:id in snippet', () => {
    const lead = row({ id: 'L', phone: '0900000199', page_id: 'p1' });
    const messages = [
      row({ id: 'm1', phone: '0987654321', page_id: 'p1' }),
      row({ id: 'm2', phone: '0900000199', page_id: 'p1', title: 'Huy' }),
    ];
    expect(findLinkedConversation(lead, messages)?.id).toBe('m2');
    const bySnippet = row({ id: 'L2', snippet: 'created from inbox:abc-1', page_id: 'p1' });
    expect(findLinkedConversation(bySnippet, [row({ id: 'abc-1', page_id: 'p1' })])?.id).toBe('abc-1');
  });
});

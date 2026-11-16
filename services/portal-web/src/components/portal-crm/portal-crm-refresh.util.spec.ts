import { describe, it, expect } from 'vitest';
import { mergeCareCases, mergeDeskMessages } from './portal-crm-refresh.util';
import type { PortalCareCase, PortalDesk } from '@/lib/api';

function caseRow(id: string, extra: Partial<PortalCareCase> = {}): PortalCareCase {
  return {
    id,
    page_id: 'p1',
    channel: 'facebook',
    kind: 'message',
    thread_key: `mess:p1:${id}`,
    title: id,
    assignee_user_id: null,
    assignee_email: '',
    status: 'waiting_receive',
    labels: [],
    customer_id: null,
    assigned_at: '',
    receive_due_at: '',
    received_at: '',
    care_started_at: '',
    care_due_at: '',
    created_at: '',
    snippet: extra.snippet ?? id,
    ...extra,
  } as PortalCareCase;
}

function desk(partial: Partial<PortalDesk> & { messages?: PortalCareCase[]; leads?: PortalCareCase[] }): PortalDesk {
  return {
    ok: true,
    channels: [],
    channel: '',
    pages: [],
    posts: [],
    products: [],
    labels: [],
    leads: [],
    messages: [],
    customers: [],
    staff: [],
    quick_replies: [],
    me: { id: 'me', role: 'approver' },
    inbox: { pages: 0, withToken: 0, leads: 0, messages: 0, leadNote: '', messageNote: '', error: '' },
    ...partial,
  } as PortalDesk;
}

describe('mergeCareCases (live pushes)', () => {
  it('adds and updates incoming rows but keeps previous ids that were not in the push', () => {
    const prev = [caseRow('a', { snippet: 'old-a' }), caseRow('b')];
    const incoming = [caseRow('b', { snippet: 'new-b' }), caseRow('c')];
    const out = mergeCareCases(prev, incoming);
    expect(out.map((row) => row.id)).toEqual(['b', 'c', 'a']);
    expect(out.find((row) => row.id === 'b')?.snippet).toBe('new-b');
    expect(out.find((row) => row.id === 'a')?.snippet).toBe('old-a');
  });

  it('keeps the previous list when a live push is empty', () => {
    const prev = [caseRow('a')];
    expect(mergeCareCases(prev, []).map((row) => row.id)).toEqual(['a']);
  });
});

describe('mergeDeskMessages (desk poll replacement)', () => {
  it('drops cases the server no longer returns, so moved-away rows leave the list and counts', () => {
    const prev = desk({
      messages: [caseRow('mine'), caseRow('moved', { assignee_user_id: 'other' })],
      leads: [caseRow('lead-old')],
      customers: [caseRow('cust-old')],
    });
    const next = desk({
      messages: [caseRow('mine', { snippet: 'fresh' }), caseRow('new')],
      leads: [caseRow('lead-new')],
      customers: [],
    });
    const out = mergeDeskMessages(prev, next);
    expect(out.messages.map((row) => row.id)).toEqual(['mine', 'new']);
    expect(out.messages.find((row) => row.id === 'mine')?.snippet).toBe('fresh');
    expect(out.leads.map((row) => row.id)).toEqual(['lead-new']);
    expect(out.customers).toEqual([]);
    expect(out.messages.some((row) => row.id === 'moved')).toBe(false);
  });

  it('replaces with an empty server list instead of keeping stale rows', () => {
    const prev = desk({ messages: [caseRow('stale')] });
    const next = desk({ messages: [] });
    expect(mergeDeskMessages(prev, next).messages).toEqual([]);
  });
});

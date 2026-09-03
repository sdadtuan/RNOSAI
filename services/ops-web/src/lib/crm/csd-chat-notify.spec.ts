import { describe, expect, it } from 'vitest';
import { csdChatNotifyChannel, nextCsdChatIncoming } from './csd-chat-notify';
import type { CsdConversationRow } from '@/lib/crm/csd-api';

function row(partial: Partial<CsdConversationRow> & { id: string }): CsdConversationRow {
  return {
    kind: 'direct',
    name_vi: 'An',
    unread_count: 1,
    last_message_at: '2026-09-03T10:00:00.000Z',
    preview: 'Chào',
    ...partial,
  };
}

describe('csdChatNotifyChannel', () => {
  it('toasts when the CRM tab is visible', () => {
    expect(csdChatNotifyChannel('visible', 'default')).toBe('toast');
    expect(csdChatNotifyChannel('visible', 'granted')).toBe('toast');
    expect(csdChatNotifyChannel('visible', 'denied')).toBe('toast');
  });

  it('uses desktop notification only when the tab is hidden and permission is granted', () => {
    expect(csdChatNotifyChannel('hidden', 'granted')).toBe('desktop');
    expect(csdChatNotifyChannel('hidden', 'default')).toBe('none');
    expect(csdChatNotifyChannel('hidden', 'denied')).toBe('none');
    expect(csdChatNotifyChannel('hidden', 'unsupported')).toBe('none');
  });
});

describe('nextCsdChatIncoming', () => {
  it('baselines the first poll so login does not toast existing unread', () => {
    const first = nextCsdChatIncoming({
      previousNotified: null,
      items: [row({ id: 'c1' })],
    });
    expect(first.incoming).toEqual([]);
    expect([...first.notified]).toEqual(['c1:2026-09-03T10:00:00.000Z']);
  });

  it('alerts when unread last_message_at is new', () => {
    const prev = new Set(['c1:2026-09-03T10:00:00.000Z']);
    const out = nextCsdChatIncoming({
      previousNotified: prev,
      items: [row({ id: 'c1', last_message_at: '2026-09-03T10:01:00.000Z', preview: 'Ping' })],
    });
    expect(out.incoming).toEqual([
      {
        conversationId: 'c1',
        title: 'An',
        preview: 'Ping',
        lastMessageAt: '2026-09-03T10:01:00.000Z',
      },
    ]);
  });

  it('skips the conversation the user is already viewing', () => {
    const out = nextCsdChatIncoming({
      previousNotified: new Set(),
      viewingId: 'c1',
      items: [row({ id: 'c1', last_message_at: '2026-09-03T10:02:00.000Z' })],
    });
    expect(out.incoming).toEqual([]);
    expect(out.notified.has('c1:2026-09-03T10:02:00.000Z')).toBe(true);
  });

  it('does not alert read conversations or the same unread key twice', () => {
    const prev = new Set(['c1:2026-09-03T10:00:00.000Z']);
    const same = nextCsdChatIncoming({
      previousNotified: prev,
      items: [row({ id: 'c1' })],
    });
    expect(same.incoming).toEqual([]);
    const read = nextCsdChatIncoming({
      previousNotified: prev,
      items: [row({ id: 'c1', unread_count: 0 })],
    });
    expect(read.incoming).toEqual([]);
    expect(read.notified.size).toBe(0);
  });
});

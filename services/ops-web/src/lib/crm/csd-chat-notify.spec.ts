import { describe, expect, it } from 'vitest';
import { csdChatNotifyChannel, csdChatNotifyKey, nextCsdChatIncoming } from './csd-chat-notify';
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

describe('notify tags', () => {
  it('keeps message and call tags stable', async () => {
    const { csdChatCallNotifyTag, csdChatMessageNotifyTag } = await import('./csd-chat-notify-persist');
    expect(csdChatMessageNotifyTag('abc', '2026-01-01')).toBe('csd-chat:abc:2026-01-01');
    expect(csdChatCallNotifyTag('staff_1')).toBe('csd-call:staff_1');
  });

  it('builds unique message tags per last_message_at', async () => {
    const { csdChatMessageNotifyTag } = await import('./csd-chat-notify-persist');
    expect(csdChatMessageNotifyTag('abc', 't1')).toBe('csd-chat:abc:t1');
    expect(csdChatMessageNotifyTag('abc', 't2')).not.toBe(csdChatMessageNotifyTag('abc', 't1'));
  });
});

describe('csdChatNotifyKey', () => {
  it('changes when unread_count or preview changes', () => {
    const a = csdChatNotifyKey(row({ id: 'c1', unread_count: 1, preview: 'A' }));
    const b = csdChatNotifyKey(row({ id: 'c1', unread_count: 2, preview: 'B' }));
    expect(a).not.toBe(b);
  });
});

describe('nextCsdChatIncoming', () => {
  it('baselines the first poll so login does not toast existing unread', () => {
    const first = nextCsdChatIncoming({
      previousNotified: null,
      items: [row({ id: 'c1' })],
    });
    expect(first.incoming).toEqual([]);
    expect([...first.notified]).toEqual([csdChatNotifyKey(row({ id: 'c1' }))]);
  });

  it('alerts when unread last_message_at is new', () => {
    const prevRow = row({ id: 'c1' });
    const prev = new Set([csdChatNotifyKey(prevRow)]);
    const nextRow = row({
      id: 'c1',
      last_message_at: '2026-09-03T10:01:00.000Z',
      preview: 'Ping',
      unread_count: 2,
    });
    const out = nextCsdChatIncoming({
      previousNotified: prev,
      items: [nextRow],
    });
    expect(out.incoming).toEqual([
      {
        conversationId: 'c1',
        title: 'An',
        preview: 'Ping',
        lastMessageAt: '2026-09-03T10:01:00.000Z',
        avatarStaffId: null,
        avatarHasPhoto: false,
        avatarUpdatedAt: null,
      },
    ]);
  });

  it('skips the conversation the user is already viewing when tab is visible', () => {
    const out = nextCsdChatIncoming({
      previousNotified: new Set(),
      viewingId: 'c1',
      tabHidden: false,
      items: [row({ id: 'c1', last_message_at: '2026-09-03T10:02:00.000Z' })],
    });
    expect(out.incoming).toEqual([]);
  });

  it('still alerts viewing conversation when CRM tab is hidden', () => {
    const out = nextCsdChatIncoming({
      previousNotified: new Set(),
      viewingId: 'c1',
      tabHidden: true,
      items: [row({ id: 'c1', last_message_at: '2026-09-03T10:02:00.000Z', preview: 'Hi' })],
    });
    expect(out.incoming).toHaveLength(1);
    expect(out.incoming[0]?.preview).toBe('Hi');
  });

  it('does not alert read conversations or the same unread key twice', () => {
    const prev = new Set([csdChatNotifyKey(row({ id: 'c1' }))]);
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

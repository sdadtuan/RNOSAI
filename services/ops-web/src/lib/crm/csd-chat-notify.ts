import type { CsdConversationRow } from '@/lib/crm/csd-api';

export type CsdChatIncoming = {
  conversationId: string;
  title: string;
  preview: string;
  lastMessageAt: string | null;
};

export type CsdChatNotifyChannel = 'toast' | 'desktop' | 'none';

export function csdChatNotifyKey(row: Pick<CsdConversationRow, 'id' | 'last_message_at'>): string {
  return `${row.id}:${row.last_message_at ?? ''}`;
}

export function csdChatNotifyChannel(
  visibility: DocumentVisibilityState | 'visible' | 'hidden',
  permission: NotificationPermission | 'unsupported',
): CsdChatNotifyChannel {
  if (visibility === 'visible') return 'toast';
  if (permission === 'granted') return 'desktop';
  return 'none';
}

export function nextCsdChatIncoming(input: {
  previousNotified: Set<string> | null;
  items: CsdConversationRow[];
  viewingId?: string | null;
}): { incoming: CsdChatIncoming[]; notified: Set<string> } {
  const viewingId = input.viewingId ?? null;
  const unread = input.items.filter((row) => Number(row.unread_count ?? 0) > 0);
  const notified = new Set<string>();
  for (const row of unread) notified.add(csdChatNotifyKey(row));

  if (!input.previousNotified) {
    return { incoming: [], notified };
  }

  const incoming: CsdChatIncoming[] = [];
  for (const row of unread) {
    const key = csdChatNotifyKey(row);
    if (row.id === viewingId) continue;
    if (input.previousNotified.has(key)) continue;
    incoming.push({
      conversationId: row.id,
      title: row.name_vi || 'Chat',
      preview: (row.preview ?? '').trim() || 'Tin nhắn mới',
      lastMessageAt: row.last_message_at ?? null,
    });
  }
  return { incoming: incoming.slice(0, 3), notified };
}

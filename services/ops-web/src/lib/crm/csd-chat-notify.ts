import type { CsdConversationRow } from '@/lib/crm/csd-api';

export type CsdChatIncoming = {
  conversationId: string;
  title: string;
  preview: string;
  lastMessageAt: string | null;
  avatarStaffId?: number | null;
  avatarHasPhoto?: boolean;
  avatarUpdatedAt?: string | null;
};

export type CsdChatNotifyChannel = 'toast' | 'desktop' | 'none';

export function csdChatNotifyKey(
  row: Pick<CsdConversationRow, 'id' | 'last_message_at' | 'unread_count'> & {
    preview?: string | null;
  },
): string {
  const preview = (row.preview ?? '').trim().slice(0, 40);
  return `${row.id}:${row.last_message_at ?? ''}:${Number(row.unread_count ?? 0)}:${preview}`;
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
  /** When CRM tab is hidden, still alert even if a thread is "selected" in the dock. */
  tabHidden?: boolean;
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
    if (!input.tabHidden && row.id === viewingId) continue;
    if (input.previousNotified.has(key)) continue;
    incoming.push({
      conversationId: row.id,
      title: row.name_vi || 'Chat',
      preview: (row.preview ?? '').trim() || 'Tin nhắn mới',
      lastMessageAt: row.last_message_at ?? null,
      avatarStaffId: row.avatar_staff_id ?? null,
      avatarHasPhoto: Boolean(row.avatar_has_photo),
      avatarUpdatedAt: row.avatar_updated_at ?? null,
    });
  }
  return { incoming: incoming.slice(0, 3), notified };
}

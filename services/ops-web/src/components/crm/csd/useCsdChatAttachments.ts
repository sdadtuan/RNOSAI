'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  fetchCsdChatAttachments,
  type CsdConversationAttachmentItem,
} from '@/lib/crm/csd-api';
import { splitCsdConversationAttachments } from '@/lib/crm/csd-chat-display';

type UseCsdChatAttachmentsOpts = {
  conversationId?: string;
  peerStaffId?: number;
  limit?: number;
  refreshKey?: string;
  enabled?: boolean;
};

export function useCsdChatAttachments(token: string, opts: UseCsdChatAttachmentsOpts = {}) {
  const { conversationId, peerStaffId, limit, refreshKey = '', enabled = true } = opts;
  const [items, setItems] = useState<CsdConversationAttachmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled || !token) {
      setItems([]);
      setLoading(false);
      setError('');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    void fetchCsdChatAttachments(token, { conversationId, peerStaffId, limit })
      .then((out) => {
        if (!cancelled) setItems(out.items ?? []);
      })
      .catch((err) => {
        if (!cancelled) {
          setItems([]);
          setError(err instanceof Error ? err.message : 'Không tải được ảnh/file');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, conversationId, peerStaffId, limit, refreshKey, enabled]);

  const media = useMemo(() => splitCsdConversationAttachments(items), [items]);

  return { items, loading, error, ...media };
}

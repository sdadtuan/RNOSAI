'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { hideLead } from '@/lib/api';
import { humanizeCrmApiError } from '@/lib/crm/crm-api-error';

/**
 * Ẩn lead the same way confirmed Sai số does: lock it and drop it from
 * lists and queues. Status is hidden_lead, not invalid_contact.
 */
export function HideLeadButton({
  token,
  leadId,
  variant = 'hero',
  onError,
}: {
  token: string;
  leadId: number;
  variant?: 'hero' | 'desk';
  onError?: (message: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onHide() {
    const reason = window.prompt(
      'Ẩn lead này khỏi danh sách và hàng đợi. Chỉ Super Admin còn xem được. Nhập ghi chú (3–500 ký tự):',
    );
    if (reason == null) return;
    const notes = reason.trim();
    if (notes.length < 3 || notes.length > 500) {
      const message = 'Ghi chú Ẩn lead cần từ 3 đến 500 ký tự.';
      onError?.(message);
      window.alert(message);
      return;
    }
    if (!window.confirm(`Ẩn lead #${leadId}? Thao tác này khóa lead giống Sai số.`)) return;
    setBusy(true);
    try {
      await hideLead(token, leadId, notes);
      router.push('/crm/leads');
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      const message = humanizeCrmApiError(code);
      onError?.(message);
      window.alert(message);
    } finally {
      setBusy(false);
    }
  }

  const className = variant === 'desk' ? 'ahd-btn ahd-btn--ghost' : 'btn btn-sm';
  return (
    <button
      type="button"
      className={className}
      data-testid="hide-lead-button"
      disabled={busy}
      onClick={() => void onHide()}
    >
      {busy ? 'Đang ẩn…' : 'Ẩn Lead'}
    </button>
  );
}

'use client';

import Link from 'next/link';
import { useState } from 'react';
import { resolveLeadDuplicate, type LeadRow } from '@/lib/api';

export function LeadDuplicateNotice({
  token,
  lead,
  onUpdated,
  onError,
}: {
  token: string;
  lead: LeadRow;
  onUpdated: (lead: LeadRow) => void;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  if (!lead.is_duplicate && lead.has_return_customer) {
    return (
      <p className="lead-dup-notice" style={{ background: '#f3f4f6', borderColor: '#e5e7eb', color: '#4b5563' }} role="status">
        <span className="lead-return-badge" style={{ marginLeft: 0 }}>Khách quay lại</span>
      </p>
    );
  }
  if (lead.merged_into_id) {
    return (
      <div className="lead-dup-notice" role="status">
        Đã gộp vào <Link href={`/crm/leads/${lead.merged_into_id}`}>Lead #{lead.merged_into_id}</Link>.
      </div>
    );
  }
  if (!lead.is_duplicate || !lead.duplicate_of_id) return null;
  const name = lead.duplicate_of_name?.trim() || '—';
  const owner = lead.duplicate_of_owner_name?.trim();
  async function run(action: 'merge' | 'not_duplicate') {
    setBusy(true);
    try {
      onUpdated(await resolveLeadDuplicate(token, lead.id, action));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Không xử lý được lead trùng');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="lead-dup-notice" role="status">
      <span>
        Trùng SĐT với{' '}
        <Link href={`/crm/leads/${lead.duplicate_of_id}`}>Lead #{lead.duplicate_of_id}</Link> ({name})
        {' – '}
        {owner ? `${owner} đang phụ trách` : 'chưa có người phụ trách'}
      </span>
      <span className="lead-dup-notice__actions">
        <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => void run('merge')}>
          Gộp vào Lead cũ
        </button>
        <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => void run('not_duplicate')}>
          Không trùng
        </button>
      </span>
    </div>
  );
}

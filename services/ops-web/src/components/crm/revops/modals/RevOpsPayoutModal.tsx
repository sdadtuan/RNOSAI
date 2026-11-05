'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import { createRevopsPayoutBatch, fetchRevopsPayoutBatches, type RevopsPayoutBatch } from '@/lib/crm/revops-api';
import { useToast } from '@/lib/toast';
import { RevOpsModalFrame } from '../RevOpsModalFrame';

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function RevOpsPayoutModal({
  open,
  token,
  onClose,
}: {
  open: boolean;
  token: string;
  onClose: () => void;
}) {
  const { push } = useToast();
  const [period, setPeriod] = useState(currentPeriod());
  const [batches, setBatches] = useState<RevopsPayoutBatch[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !token) return;
    setPeriod(currentPeriod());
    void fetchRevopsPayoutBatches(token)
      .then((out) => setBatches(out.items ?? []))
      .catch(() => setBatches([]));
  }, [open, token]);

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (saving) return;
    if (!/^\d{4}-\d{2}$/.test(period.trim())) {
      push('Kỳ phải theo định dạng YYYY-MM', 'error');
      return;
    }
    setSaving(true);
    try {
      await createRevopsPayoutBatch(token, period.trim());
      push('Payout batch đã được tạo', 'success');
      onClose();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'Không tạo được batch', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <RevOpsModalFrame
      open={open}
      title="Payout Batch"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="revops-btn" onClick={onClose} disabled={saving}>
            Hủy
          </button>
          <button type="submit" form="revops-payout-form" className="revops-btn revops-btn--primary" disabled={saving}>
            {saving ? 'Đang lưu…' : 'Tạo batch'}
          </button>
        </>
      }
    >
      <form id="revops-payout-form" onSubmit={onSubmit}>
        <label className="revops-field">
          <span>
            Kỳ (YYYY-MM) <span className="revops-req">*</span>
          </span>
          <input value={period} onChange={(ev) => setPeriod(ev.target.value)} placeholder="2026-09" required />
        </label>
        {batches.length > 0 ? (
          <p className="revops-muted" style={{ marginTop: '1rem' }}>
            Batch gần đây: {batches.slice(0, 3).map((b) => `${b.period} (${b.status})`).join(' · ')}
          </p>
        ) : null}
      </form>
    </RevOpsModalFrame>
  );
}

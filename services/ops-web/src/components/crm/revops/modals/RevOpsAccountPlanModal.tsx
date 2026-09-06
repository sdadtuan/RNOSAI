'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import {
  createAmPlan,
  fetchAmAccounts,
  type AmAccountListItem,
  type AmPlanKind,
} from '@/lib/crm/am-api';
import { useToast } from '@/lib/toast';
import { RevOpsModalFrame } from '../RevOpsModalFrame';

const PLAN_KINDS: Array<{ value: AmPlanKind; label: string }> = [
  { value: 'care', label: 'Care plan' },
  { value: 'qbr', label: 'QBR' },
  { value: 'renewal', label: 'Renewal' },
  { value: 'expand', label: 'Expand' },
];

function currentPeriodKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function RevOpsAccountPlanModal({
  open,
  token,
  onClose,
  presetAgencyClientId,
}: {
  open: boolean;
  token: string;
  onClose: () => void;
  presetAgencyClientId?: string;
}) {
  const { push } = useToast();
  const [accounts, setAccounts] = useState<AmAccountListItem[]>([]);
  const [agencyClientId, setAgencyClientId] = useState('');
  const [kind, setKind] = useState<AmPlanKind>('care');
  const [periodKey, setPeriodKey] = useState(currentPeriodKey());
  const [dueOn, setDueOn] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !token) return;
    void fetchAmAccounts(token, { page_size: '100' })
      .then((out) => setAccounts(out.items ?? []))
      .catch(() => setAccounts([]));
  }, [open, token]);

  useEffect(() => {
    if (!open) return;
    setAgencyClientId(presetAgencyClientId ?? '');
    setKind('care');
    setPeriodKey(currentPeriodKey());
    setDueOn('');
    setNote('');
  }, [open, presetAgencyClientId]);

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (saving) return;
    if (!agencyClientId || !periodKey.trim()) {
      push('Account và kỳ plan là bắt buộc', 'error');
      return;
    }
    setSaving(true);
    try {
      await createAmPlan(token, {
        agency_client_id: agencyClientId,
        kind,
        period_key: periodKey.trim(),
        due_on: dueOn || undefined,
        override_reason: note.trim() || undefined,
      });
      push('Account plan đã được tạo', 'success');
      onClose();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'Không tạo được plan', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <RevOpsModalFrame
      open={open}
      title="Account Plan"
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="revops-btn" onClick={onClose} disabled={saving}>
            Hủy
          </button>
          <button type="submit" form="revops-plan-form" className="revops-btn revops-btn--primary" disabled={saving}>
            {saving ? 'Đang lưu…' : 'Tạo plan'}
          </button>
        </>
      }
    >
      <form id="revops-plan-form" onSubmit={onSubmit}>
        <div className="revops-form-grid">
          <label className="revops-field">
            <span>
              Account <span className="revops-req">*</span>
            </span>
            <select value={agencyClientId} onChange={(ev) => setAgencyClientId(ev.target.value)} required>
              <option value="">— Chọn account —</option>
              {accounts.map((a) => (
                <option key={a.agency_client_id} value={a.agency_client_id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="revops-field">
            <span>
              Loại plan <span className="revops-req">*</span>
            </span>
            <select value={kind} onChange={(ev) => setKind(ev.target.value as AmPlanKind)}>
              {PLAN_KINDS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="revops-field">
            <span>
              Kỳ <span className="revops-req">*</span>
            </span>
            <input type="month" value={periodKey} onChange={(ev) => setPeriodKey(ev.target.value)} required />
          </label>
          <label className="revops-field">
            <span>Due date</span>
            <input type="date" value={dueOn} onChange={(ev) => setDueOn(ev.target.value)} />
          </label>
          <label className="revops-field revops-field--full">
            <span>Ghi chú</span>
            <textarea value={note} onChange={(ev) => setNote(ev.target.value)} rows={2} />
          </label>
        </div>
      </form>
    </RevOpsModalFrame>
  );
}

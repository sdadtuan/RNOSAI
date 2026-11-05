'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, fetchStaffRoster, type StaffRosterRow } from '@/lib/api';
import { createAmHandover, fetchAmAccounts, type AmAccountListItem } from '@/lib/crm/am-api';
import { useToast } from '@/lib/toast';
import { RevOpsModalFrame } from '../RevOpsModalFrame';

export function RevOpsHandoverModal({
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
  const router = useRouter();
  const { push } = useToast();
  const [accounts, setAccounts] = useState<AmAccountListItem[]>([]);
  const [staff, setStaff] = useState<StaffRosterRow[]>([]);
  const [agencyClientId, setAgencyClientId] = useState('');
  const [receivingAeId, setReceivingAeId] = useState('');
  const [pm, setPm] = useState('');
  const [kickoffDate, setKickoffDate] = useState('');
  const [goals, setGoals] = useState('');
  const [scopeExclusions, setScopeExclusions] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !token) return;
    void Promise.all([
      fetchAmAccounts(token, { page_size: '100' }).catch(() => ({ items: [] })),
      fetchStaffRoster(token).catch(() => ({ staff: [] })),
    ]).then(([acc, roster]) => {
      setAccounts(acc.items ?? []);
      setStaff(roster.staff ?? []);
    });
  }, [open, token]);

  useEffect(() => {
    if (!open) return;
    setAgencyClientId(presetAgencyClientId ?? '');
    setReceivingAeId('');
    setPm('');
    setKickoffDate('');
    setGoals('');
    setScopeExclusions('');
  }, [open, presetAgencyClientId]);

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (saving) return;
    if (!agencyClientId || !receivingAeId || !kickoffDate.trim() || !goals.trim() || !scopeExclusions.trim()) {
      push('Deal Won, Receiving AE, Kickoff date, Goals và Scope exclusions là bắt buộc', 'error');
      return;
    }
    const ae = staff.find((s) => String(s.id) === receivingAeId);
    setSaving(true);
    try {
      const handover = await createAmHandover(token, {
        agency_client_id: agencyClientId,
        commercial_json: { kickoff_date: kickoffDate, deal_won: true },
        scope_json: { goal: goals.trim(), out_of_scope: scopeExclusions.trim() },
        stakeholders_json: {
          receiving_ae: ae?.display_name ?? receivingAeId,
          receiving_ae_staff_id: Number(receivingAeId),
          pm: pm.trim() || undefined,
        },
      });
      push('Handover package đã được khởi tạo', 'success');
      onClose();
      router.push(`/crm/account-management/onboarding?revops=1&agency_client_id=${handover.agency_client_id}`);
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'Không tạo được handover', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <RevOpsModalFrame
      open={open}
      title="Sales Handover Package"
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="revops-btn" onClick={onClose} disabled={saving}>
            Hủy
          </button>
          <button type="submit" form="revops-handover-form" className="revops-btn revops-btn--primary" disabled={saving}>
            {saving ? 'Đang lưu…' : 'Tạo handover'}
          </button>
        </>
      }
    >
      <form id="revops-handover-form" onSubmit={onSubmit}>
        <div className="revops-form-grid">
          <label className="revops-field">
            <span>
              Deal Won (Account) <span className="revops-req">*</span>
            </span>
            <select value={agencyClientId} onChange={(ev) => setAgencyClientId(ev.target.value)} required>
              <option value="">— Chọn account —</option>
              {accounts.map((a) => (
                <option key={a.agency_client_id} value={a.agency_client_id}>
                  {a.name} ({a.code})
                </option>
              ))}
            </select>
          </label>
          <label className="revops-field">
            <span>
              Receiving AE <span className="revops-req">*</span>
            </span>
            <select value={receivingAeId} onChange={(ev) => setReceivingAeId(ev.target.value)} required>
              <option value="">— Chọn AE —</option>
              {staff.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.display_name}
                </option>
              ))}
            </select>
          </label>
          <label className="revops-field">
            <span>PM</span>
            <input value={pm} onChange={(ev) => setPm(ev.target.value)} placeholder="Tên PM delivery" />
          </label>
          <label className="revops-field">
            <span>
              Kickoff date <span className="revops-req">*</span>
            </span>
            <input type="date" value={kickoffDate} onChange={(ev) => setKickoffDate(ev.target.value)} required />
          </label>
          <label className="revops-field revops-field--full">
            <span>
              Goals <span className="revops-req">*</span>
            </span>
            <textarea
              value={goals}
              onChange={(ev) => setGoals(ev.target.value)}
              rows={2}
              placeholder="Mục tiêu kinh doanh sau bàn giao…"
              required
            />
          </label>
          <label className="revops-field revops-field--full">
            <span>
              Scope exclusions <span className="revops-req">*</span>
            </span>
            <textarea
              value={scopeExclusions}
              onChange={(ev) => setScopeExclusions(ev.target.value)}
              rows={2}
              placeholder="Phạm vi không bao gồm…"
              required
            />
          </label>
        </div>
      </form>
    </RevOpsModalFrame>
  );
}

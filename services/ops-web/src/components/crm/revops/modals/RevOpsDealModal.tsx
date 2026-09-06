'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  ApiError,
  createLeadActivity,
  fetchLeads,
  patchLead,
  type LeadRow,
} from '@/lib/api';
import { useToast } from '@/lib/toast';
import { RevOpsModalFrame } from '../RevOpsModalFrame';
import { REVOPS_DEAL_STAGES, leadOptionLabel, parseVndInput } from '../revops-modal.util';

export function RevOpsDealModal({
  open,
  token,
  onClose,
  presetLeadId,
}: {
  open: boolean;
  token: string;
  onClose: () => void;
  presetLeadId?: number;
}) {
  const { push } = useToast();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [dealName, setDealName] = useState('');
  const [leadId, setLeadId] = useState('');
  const [stage, setStage] = useState<string>(REVOPS_DEAL_STAGES[0].value);
  const [closeDate, setCloseDate] = useState('');
  const [amount, setAmount] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !token) return;
    void fetchLeads(token, { limit: 50, lead_flow_kind: 'b2b_prospect' })
      .then((out) => setLeads(out.leads ?? []))
      .catch(() => setLeads([]));
  }, [open, token]);

  useEffect(() => {
    if (!open) return;
    setDealName('');
    setLeadId(presetLeadId ? String(presetLeadId) : '');
    setStage(REVOPS_DEAL_STAGES[0].value);
    setCloseDate('');
    setAmount('');
    setNextStep('');
  }, [open, presetLeadId]);

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (saving) return;
    const id = Number(leadId);
    if (!dealName.trim() || !id || !closeDate || !nextStep.trim()) {
      push('Tên deal, lead, ngày chốt và next step là bắt buộc', 'error');
      return;
    }
    const amountVnd = parseVndInput(amount);
    if (amount.trim() && amountVnd == null) {
      push('Amount không hợp lệ', 'error');
      return;
    }
    setSaving(true);
    try {
      await patchLead(token, id, { status: stage, audit_note: `RevOps deal: ${dealName.trim()}` });
      await createLeadActivity(token, id, {
        activity_type: 'note',
        content: dealName.trim(),
        next_action: nextStep.trim(),
        next_action_at: closeDate,
        result: amountVnd != null ? `Amount: ${amountVnd.toLocaleString('vi-VN')} đ` : '',
      });
      push('Deal đã được tạo trong pipeline.', 'success');
      onClose();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'Không tạo được deal', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <RevOpsModalFrame
      open={open}
      title="Tạo Opportunity / Deal"
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="revops-btn" onClick={onClose} disabled={saving}>
            Hủy
          </button>
          <button type="submit" form="revops-deal-form" className="revops-btn revops-btn--primary" disabled={saving}>
            {saving ? 'Đang tạo…' : 'Tạo deal'}
          </button>
        </>
      }
    >
      <form id="revops-deal-form" onSubmit={onSubmit}>
        <div className="revops-form-grid">
          <label className="revops-field">
            <span>
              Tên deal <span className="revops-req">*</span>
            </span>
            <input
              value={dealName}
              onChange={(ev) => setDealName(ev.target.value)}
              placeholder="ABC Holdings — CRM Enterprise 2026"
            />
          </label>
          <label className="revops-field">
            <span>
              Lead / Account <span className="revops-req">*</span>
            </span>
            <select value={leadId} onChange={(ev) => setLeadId(ev.target.value)} required>
              <option value="">Chọn lead</option>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {leadOptionLabel(lead)}
                </option>
              ))}
            </select>
          </label>
          <label className="revops-field">
            <span>
              Pipeline stage <span className="revops-req">*</span>
            </span>
            <select value={stage} onChange={(ev) => setStage(ev.target.value)}>
              {REVOPS_DEAL_STAGES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="revops-field">
            <span>
              Expected close date <span className="revops-req">*</span>
            </span>
            <input type="date" value={closeDate} onChange={(ev) => setCloseDate(ev.target.value)} />
          </label>
          <label className="revops-field">
            <span>
              Amount <span className="revops-req">*</span>
            </span>
            <input
              value={amount}
              onChange={(ev) => setAmount(ev.target.value)}
              placeholder="450,000,000"
              inputMode="numeric"
            />
          </label>
          <label className="revops-field revops-field--full">
            <span>
              Next step <span className="revops-req">*</span>
            </span>
            <textarea
              value={nextStep}
              onChange={(ev) => setNextStep(ev.target.value)}
              placeholder="Discovery meeting với COO..."
              rows={3}
            />
          </label>
        </div>
      </form>
    </RevOpsModalFrame>
  );
}

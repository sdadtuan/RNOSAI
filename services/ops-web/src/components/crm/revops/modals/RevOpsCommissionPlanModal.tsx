'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import { createRevopsCommissionPlan } from '@/lib/crm/revops-api';
import { useToast } from '@/lib/toast';
import { RevOpsModalFrame } from '../RevOpsModalFrame';

export function RevOpsCommissionPlanModal({
  open,
  token,
  onClose,
  onCreated,
}: {
  open: boolean;
  token: string;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const { push } = useToast();
  const [name, setName] = useState('');
  const [version, setVersion] = useState('1');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [ratePct, setRatePct] = useState('5');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setVersion('1');
    setEffectiveFrom('');
    setRatePct('5');
  }, [open]);

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (saving) return;
    if (!name.trim() || !effectiveFrom.trim() || !ratePct.trim()) {
      push('Tên plan, ngày hiệu lực và rate là bắt buộc', 'error');
      return;
    }
    setSaving(true);
    try {
      await createRevopsCommissionPlan(token, {
        name: name.trim(),
        version: Number(version) || 1,
        effective_from: effectiveFrom,
        revenue_basis: 'collected',
        role_code: 'ae',
        tiers: [{ min_attainment_pct: 0, max_attainment_pct: null, rate_pct: Number(ratePct) }],
      });
      push('Commission plan đã được tạo', 'success');
      onCreated?.();
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
      title="Commission Plan"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="revops-btn" onClick={onClose} disabled={saving}>
            Hủy
          </button>
          <button type="submit" form="revops-commission-plan-form" className="revops-btn revops-btn--primary" disabled={saving}>
            {saving ? 'Đang lưu…' : 'Tạo plan'}
          </button>
        </>
      }
    >
      <form id="revops-commission-plan-form" onSubmit={onSubmit}>
        <div className="revops-form-grid">
          <label className="revops-field">
            <span>
              Tên plan <span className="revops-req">*</span>
            </span>
            <input value={name} onChange={(ev) => setName(ev.target.value)} required />
          </label>
          <label className="revops-field">
            <span>Version</span>
            <input type="number" min={1} value={version} onChange={(ev) => setVersion(ev.target.value)} />
          </label>
          <label className="revops-field">
            <span>
              Effective from <span className="revops-req">*</span>
            </span>
            <input type="date" value={effectiveFrom} onChange={(ev) => setEffectiveFrom(ev.target.value)} required />
          </label>
          <label className="revops-field">
            <span>
              Base rate % <span className="revops-req">*</span>
            </span>
            <input type="number" step="0.1" value={ratePct} onChange={(ev) => setRatePct(ev.target.value)} required />
          </label>
        </div>
      </form>
    </RevOpsModalFrame>
  );
}

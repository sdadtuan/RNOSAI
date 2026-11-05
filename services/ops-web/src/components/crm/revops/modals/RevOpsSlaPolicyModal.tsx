'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import { createRevopsSlaPolicy } from '@/lib/crm/revops-api';
import { useToast } from '@/lib/toast';
import { RevOpsModalFrame } from '../RevOpsModalFrame';

const ENTITY_TYPES = [
  { value: 'lead_first_response', label: 'Lead first response' },
  { value: 'handover_accept', label: 'Handover accept' },
  { value: 'renewal_prep', label: 'Renewal prep' },
];

export function RevOpsSlaPolicyModal({
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
  const [entityType, setEntityType] = useState('lead_first_response');
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [warningMinutes, setWarningMinutes] = useState('36');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setEntityType('lead_first_response');
    setDurationMinutes('60');
    setWarningMinutes('36');
  }, [open]);

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (saving) return;
    if (!name.trim()) {
      push('Tên policy là bắt buộc', 'error');
      return;
    }
    setSaving(true);
    try {
      await createRevopsSlaPolicy(token, {
        name: name.trim(),
        entity_type: entityType,
        duration_minutes: Number(durationMinutes) || 60,
        warning_minutes: Number(warningMinutes) || 36,
      });
      push('SLA policy đã được tạo', 'success');
      onCreated?.();
      onClose();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'Không tạo được policy', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <RevOpsModalFrame
      open={open}
      title="SLA Policy"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="revops-btn" onClick={onClose} disabled={saving}>
            Hủy
          </button>
          <button type="submit" form="revops-sla-policy-form" className="revops-btn revops-btn--primary" disabled={saving}>
            {saving ? 'Đang lưu…' : 'Tạo policy'}
          </button>
        </>
      }
    >
      <form id="revops-sla-policy-form" onSubmit={onSubmit}>
        <div className="revops-form-grid">
          <label className="revops-field">
            <span>
              Tên <span className="revops-req">*</span>
            </span>
            <input value={name} onChange={(ev) => setName(ev.target.value)} required />
          </label>
          <label className="revops-field">
            <span>Entity type</span>
            <select value={entityType} onChange={(ev) => setEntityType(ev.target.value)}>
              {ENTITY_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="revops-field">
            <span>Duration (phút)</span>
            <input type="number" min={1} value={durationMinutes} onChange={(ev) => setDurationMinutes(ev.target.value)} />
          </label>
          <label className="revops-field">
            <span>Warning (phút trước due)</span>
            <input type="number" min={1} value={warningMinutes} onChange={(ev) => setWarningMinutes(ev.target.value)} />
          </label>
        </div>
      </form>
    </RevOpsModalFrame>
  );
}

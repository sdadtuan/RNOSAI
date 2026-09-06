'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import { fetchKpiHubDictionary, upsertKpiHubTarget } from '@/lib/kpi-hub-api';
import { useToast } from '@/lib/toast';
import { RevOpsModalFrame } from '../RevOpsModalFrame';

type DictRow = { id: string; code: string; name: string };

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function RevOpsKpiModal({
  open,
  token,
  onClose,
}: {
  open: boolean;
  token: string;
  onClose: () => void;
}) {
  const { push } = useToast();
  const [dictionary, setDictionary] = useState<DictRow[]>([]);
  const [period, setPeriod] = useState(currentPeriod());
  const [scopeType, setScopeType] = useState('WORKSPACE');
  const [scopeLabel, setScopeLabel] = useState('Toàn workspace');
  const [dictionaryId, setDictionaryId] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !token) return;
    void fetchKpiHubDictionary(token, { page: '1', page_size: '100' })
      .then((raw) => {
        const rows = (raw.data ?? []) as Array<Record<string, unknown>>;
        setDictionary(
          rows.map((row) => ({
            id: String(row.id ?? ''),
            code: String(row.code ?? ''),
            name: String(row.name ?? row.code ?? ''),
          })),
        );
      })
      .catch(() => setDictionary([]));
  }, [open, token]);

  useEffect(() => {
    if (!open) return;
    setPeriod(currentPeriod());
    setScopeType('WORKSPACE');
    setScopeLabel('Toàn workspace');
    setDictionaryId('');
    setTargetValue('');
    setNote('');
  }, [open]);

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (saving) return;
    if (!period.trim() || !dictionaryId || !targetValue.trim()) {
      push('Kỳ, KPI và target là bắt buộc', 'error');
      return;
    }
    setSaving(true);
    try {
      await upsertKpiHubTarget(token, {
        dictionary_id: dictionaryId,
        period: period.trim(),
        scope_type: scopeType,
        scope_label: scopeLabel.trim() || scopeType,
        target_value: Number(targetValue),
      });
      push('KPI target đã được giao', 'success');
      onClose();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'Không giao được KPI', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <RevOpsModalFrame
      open={open}
      title="Giao KPI"
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="revops-btn" onClick={onClose} disabled={saving}>
            Hủy
          </button>
          <button type="submit" form="revops-kpi-form" className="revops-btn revops-btn--primary" disabled={saving}>
            {saving ? 'Đang lưu…' : 'Giao KPI'}
          </button>
        </>
      }
    >
      <form id="revops-kpi-form" onSubmit={onSubmit}>
        <div className="revops-form-grid">
          <label className="revops-field">
            <span>
              Kỳ <span className="revops-req">*</span>
            </span>
            <input type="month" value={period} onChange={(ev) => setPeriod(ev.target.value)} required />
          </label>
          <label className="revops-field">
            <span>
              Áp dụng cho <span className="revops-req">*</span>
            </span>
            <select
              value={scopeType}
              onChange={(ev) => {
                setScopeType(ev.target.value);
                setScopeLabel(
                  ev.target.value === 'TEAM'
                    ? 'Team'
                    : ev.target.value === 'DEPARTMENT'
                      ? 'Department'
                      : 'Toàn workspace',
                );
              }}
            >
              <option value="WORKSPACE">Workspace</option>
              <option value="DEPARTMENT">Department</option>
              <option value="TEAM">Team</option>
            </select>
          </label>
          <label className="revops-field">
            <span>Nhãn phạm vi</span>
            <input value={scopeLabel} onChange={(ev) => setScopeLabel(ev.target.value)} />
          </label>
          <label className="revops-field">
            <span>
              KPI <span className="revops-req">*</span>
            </span>
            <select value={dictionaryId} onChange={(ev) => setDictionaryId(ev.target.value)} required>
              <option value="">— Chọn KPI —</option>
              {dictionary.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="revops-field">
            <span>
              Target <span className="revops-req">*</span>
            </span>
            <input type="number" value={targetValue} onChange={(ev) => setTargetValue(ev.target.value)} required />
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

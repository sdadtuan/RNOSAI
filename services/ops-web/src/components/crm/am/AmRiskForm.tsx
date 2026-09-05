'use client';

import { FormEvent, useState } from 'react';
import { ApiError } from '@/lib/api';
import { createAmRecoveryPlan, createAmRisk } from '@/lib/crm/am-api';
import {
  AM_RISK_CATEGORIES,
  AM_RISK_SEVERITIES,
  amRiskPxI,
} from '@/lib/crm/am-risk.util';
import { useToast } from '@/lib/toast';
import { useAmPage } from './AmShell';

type AmRiskFormProps = {
  agencyClientId: string;
  canEdit: boolean;
  mode?: 'risk' | 'recovery';
  onClose: () => void;
  onSaved: () => void;
};

export function AmRiskForm({
  agencyClientId,
  canEdit,
  mode = 'risk',
  onClose,
  onSaved,
}: AmRiskFormProps) {
  const { token } = useAmPage();
  const { push } = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [category, setCategory] = useState<string>(AM_RISK_CATEGORIES[0].value);
  const [severity, setSeverity] = useState<string>('medium');
  const [probability, setProbability] = useState('');
  const [impact, setImpact] = useState('');
  const [evidence, setEvidence] = useState('');
  const [ownerStaffId, setOwnerStaffId] = useState('');
  const [dueOn, setDueOn] = useState('');
  const [createRecovery, setCreateRecovery] = useState(mode === 'recovery');
  const [goal, setGoal] = useState('');

  const title = mode === 'recovery' ? 'Tạo recovery' : 'Tạo rủi ro';

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!canEdit || saving) return;
    if (mode === 'risk' && !evidence.trim()) {
      setError('Cần evidence');
      return;
    }
    if ((mode === 'recovery' || createRecovery) && !goal.trim()) {
      setError('Cần mục tiêu recovery');
      return;
    }
    setSaving(true);
    setError('');
    try {
      let riskId: string | undefined;
      if (mode === 'risk') {
        const risk = await createAmRisk(token, {
          agency_client_id: agencyClientId,
          category,
          severity,
          probability: probability ? Number(probability) : undefined,
          impact: impact ? Number(impact) : undefined,
          evidence: evidence.trim(),
          owner_staff_id: ownerStaffId ? Number(ownerStaffId) : undefined,
          due_on: dueOn || undefined,
        });
        riskId = risk.id;
      }
      if (mode === 'recovery' || createRecovery) {
        await createAmRecoveryPlan(token, {
          agency_client_id: agencyClientId,
          risk_id: riskId,
          goal: goal.trim(),
        });
      }
      push(mode === 'recovery' ? 'Đã tạo recovery' : 'Đã tạo rủi ro', 'success');
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không lưu được');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="am-drawer-bg"
      role="presentation"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget && !saving) onClose();
      }}
    >
      <div className="am-drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="am-drawer__head">
          <strong>{title}</strong>
          <button type="button" className="am-btn" onClick={onClose}>
            Đóng
          </button>
        </div>
        <form className="am-form" onSubmit={(ev) => void onSubmit(ev)}>
          {mode === 'risk' ? (
            <>
              <label className="am-field">
                <span>Danh mục *</span>
                <select value={category} onChange={(ev) => setCategory(ev.target.value)}>
                  {AM_RISK_CATEGORIES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="am-field">
                <span>Severity *</span>
                <select value={severity} onChange={(ev) => setSeverity(ev.target.value)}>
                  {AM_RISK_SEVERITIES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="am-field">
                <span>Probability (P)</span>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={probability}
                  onChange={(ev) => setProbability(ev.target.value)}
                />
              </label>
              <label className="am-field">
                <span>Impact (I)</span>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={impact}
                  onChange={(ev) => setImpact(ev.target.value)}
                />
              </label>
              <p className="am-muted">P×I: {amRiskPxI(probability, impact)}</p>
              <label className="am-field">
                <span>Evidence *</span>
                <textarea
                  required
                  rows={3}
                  value={evidence}
                  onChange={(ev) => setEvidence(ev.target.value)}
                  placeholder="Bằng chứng / mô tả"
                />
              </label>
              <label className="am-field">
                <span>Owner (crm_staff ID)</span>
                <input
                  inputMode="numeric"
                  value={ownerStaffId}
                  onChange={(ev) => setOwnerStaffId(ev.target.value)}
                  placeholder="optional"
                />
              </label>
              <label className="am-field">
                <span>Hạn</span>
                <input type="date" value={dueOn} onChange={(ev) => setDueOn(ev.target.value)} />
              </label>
              <label className="am-check">
                <input
                  type="checkbox"
                  checked={createRecovery}
                  onChange={(ev) => setCreateRecovery(ev.target.checked)}
                />
                Tạo recovery
              </label>
            </>
          ) : null}
          {mode === 'recovery' || createRecovery ? (
            <label className="am-field">
              <span>Mục tiêu recovery *</span>
              <textarea
                required={mode === 'recovery' || createRecovery}
                rows={3}
                value={goal}
                onChange={(ev) => setGoal(ev.target.value)}
                placeholder="Mục tiêu thoát Critical"
              />
            </label>
          ) : null}
          {error ? <p className="am-banner">{error}</p> : null}
          <div className="am-form__actions">
            <button type="button" className="am-btn" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className="am-btn am-btn--primary" disabled={!canEdit || saving}>
              {saving ? 'Đang lưu…' : 'Lưu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

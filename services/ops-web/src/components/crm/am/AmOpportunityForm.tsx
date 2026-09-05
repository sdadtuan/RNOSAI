'use client';

import { FormEvent, useState } from 'react';
import { ApiError } from '@/lib/api';
import { createAmOpportunity, type AmCreateOpportunityInput, type AmOppStage } from '@/lib/crm/am-api';
import { AM_OPP_KIND_OPTS, AM_OPP_STAGES, amGrowthStageLabel } from '@/lib/crm/am-growth.util';
import { useToast } from '@/lib/toast';
import { useAmPage } from './AmShell';

export type AmOpportunityDraft = Partial<AmCreateOpportunityInput> & {
  ai_evidence_json?: unknown;
};

type AmOpportunityFormProps = {
  agencyClientId?: string;
  canEdit: boolean;
  draft?: AmOpportunityDraft;
  onClose: () => void;
  onSaved: () => void;
};

export function AmOpportunityForm({
  agencyClientId,
  canEdit,
  draft,
  onClose,
  onSaved,
}: AmOpportunityFormProps) {
  const { token, data } = useAmPage();
  const { push } = useToast();
  const book = data?.my_book ?? [];
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [accountId, setAccountId] = useState(agencyClientId || draft?.agency_client_id || '');
  const [title, setTitle] = useState(draft?.title ?? '');
  const [kind, setKind] = useState(draft?.kind ?? '');
  const [pkg, setPkg] = useState(draft?.package ?? '');
  const [value, setValue] = useState(draft?.value_vnd != null ? String(draft.value_vnd) : '');
  const [probability, setProbability] = useState(
    draft?.probability != null ? String(draft.probability) : '',
  );
  const [stage, setStage] = useState<AmOppStage>(draft?.stage ?? 'qualify');
  const [nextStep, setNextStep] = useState(draft?.next_step ?? '');

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!canEdit || saving) return;
    const clientId = (agencyClientId || accountId).trim();
    if (!clientId || !title.trim() || !nextStep.trim()) {
      setError('Cần account, tiêu đề và next step');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createAmOpportunity(token, {
        agency_client_id: clientId,
        title: title.trim(),
        kind: kind.trim() || undefined,
        package: pkg.trim() || undefined,
        value_vnd: value ? Number(value) : undefined,
        probability: probability ? Number(probability) : undefined,
        stage,
        next_step: nextStep.trim(),
        source: draft?.source ?? 'manual',
        ai_evidence_json: draft?.ai_evidence_json,
      });
      push('Đã tạo cơ hội', 'success');
      onSaved();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Không lưu được';
      setError(message === 'client_not_found' ? 'Khách chưa convert — không tạo cơ hội' : message);
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
      <div className="am-drawer" role="dialog" aria-modal="true" aria-label="Tạo cơ hội tăng trưởng">
        <div className="am-drawer__head">
          <strong>Tạo cơ hội tăng trưởng</strong>
          <button type="button" className="am-btn" onClick={onClose}>
            Đóng
          </button>
        </div>
        <form className="am-form" onSubmit={(ev) => void onSubmit(ev)}>
          <label className="am-field">
            <span>Account *</span>
            {agencyClientId ? (
              <input value={agencyClientId} readOnly />
            ) : book.length > 0 ? (
              <select value={accountId} required onChange={(ev) => setAccountId(ev.target.value)}>
                <option value="" disabled>
                  Chọn khách
                </option>
                {book.map((row) => (
                  <option key={row.agency_client_id} value={row.agency_client_id}>
                    {row.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                required
                value={accountId}
                onChange={(ev) => setAccountId(ev.target.value)}
                placeholder="agency_client_id"
              />
            )}
          </label>
          <label className="am-field">
            <span>Tiêu đề *</span>
            <input required maxLength={200} value={title} onChange={(ev) => setTitle(ev.target.value)} />
          </label>
          <label className="am-field">
            <span>Loại</span>
            <select value={kind} onChange={(ev) => setKind(ev.target.value)}>
              {AM_OPP_KIND_OPTS.map((opt) => (
                <option key={opt.value || 'empty'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="am-field">
            <span>Gói</span>
            <input value={pkg} onChange={(ev) => setPkg(ev.target.value)} placeholder="Gói / dịch vụ" />
          </label>
          <label className="am-field">
            <span>Giá trị (VND)</span>
            <input
              type="number"
              min={0}
              step={1}
              value={value}
              onChange={(ev) => setValue(ev.target.value)}
            />
          </label>
          <label className="am-field">
            <span>Xác suất (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={probability}
              onChange={(ev) => setProbability(ev.target.value)}
            />
          </label>
          <label className="am-field">
            <span>Stage</span>
            <select value={stage} onChange={(ev) => setStage(ev.target.value as AmOppStage)}>
              {AM_OPP_STAGES.map((opt) => (
                <option key={opt} value={opt}>
                  {amGrowthStageLabel(opt)}
                </option>
              ))}
            </select>
          </label>
          <label className="am-field">
            <span>Next step *</span>
            <input
              required
              value={nextStep}
              onChange={(ev) => setNextStep(ev.target.value)}
              placeholder="Bước tiếp theo"
            />
          </label>
          {error ? <p className="am-banner">{error}</p> : null}
          <div className="am-form__actions">
            <button type="button" className="am-btn" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className="am-btn am-btn--primary" disabled={!canEdit || saving}>
              {saving ? 'Đang lưu…' : 'Tạo cơ hội'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

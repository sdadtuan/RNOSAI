'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import {
  createAmOpportunity,
  fetchAmAccounts,
  type AmAccountListItem,
  type AmOppStage,
} from '@/lib/crm/am-api';
import { AM_OPP_KIND_OPTS, AM_OPP_STAGES, amGrowthStageLabel } from '@/lib/crm/am-growth.util';
import { useToast } from '@/lib/toast';
import { RevOpsModalFrame } from '../RevOpsModalFrame';

export function RevOpsGrowthModal({
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
  const [kind, setKind] = useState('');
  const [product, setProduct] = useState('');
  const [amount, setAmount] = useState('');
  const [evidence, setEvidence] = useState('');
  const [stage, setStage] = useState<AmOppStage>('qualify');
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
    setKind('');
    setProduct('');
    setAmount('');
    setEvidence('');
    setStage('qualify');
  }, [open, presetAgencyClientId]);

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (saving) return;
    if (!agencyClientId || !kind.trim() || !evidence.trim()) {
      push('Account, Type và Signal/Evidence là bắt buộc', 'error');
      return;
    }
    setSaving(true);
    try {
      await createAmOpportunity(token, {
        agency_client_id: agencyClientId,
        title: product.trim() || `${kind} opportunity`,
        kind: kind.trim(),
        package: product.trim() || undefined,
        value_vnd: amount ? Number(amount) : undefined,
        stage,
        next_step: evidence.trim(),
        source: 'revops',
        ai_evidence_json: { signal: evidence.trim() },
      });
      push('Growth opportunity đã được tạo', 'success');
      onClose();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'Không tạo được cơ hội', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <RevOpsModalFrame
      open={open}
      title="Growth Opportunity"
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="revops-btn" onClick={onClose} disabled={saving}>
            Hủy
          </button>
          <button type="submit" form="revops-growth-form" className="revops-btn revops-btn--primary" disabled={saving}>
            {saving ? 'Đang lưu…' : 'Tạo cơ hội'}
          </button>
        </>
      }
    >
      <form id="revops-growth-form" onSubmit={onSubmit}>
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
              Type <span className="revops-req">*</span>
            </span>
            <select value={kind} onChange={(ev) => setKind(ev.target.value)} required>
              <option value="">— Chọn loại —</option>
              {AM_OPP_KIND_OPTS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="revops-field">
            <span>Product</span>
            <input value={product} onChange={(ev) => setProduct(ev.target.value)} placeholder="Gói / SKU" />
          </label>
          <label className="revops-field">
            <span>Amount (VND)</span>
            <input type="number" value={amount} onChange={(ev) => setAmount(ev.target.value)} min={0} />
          </label>
          <label className="revops-field">
            <span>Stage</span>
            <select value={stage} onChange={(ev) => setStage(ev.target.value as AmOppStage)}>
              {AM_OPP_STAGES.map((opt) => (
                <option key={opt} value={opt}>
                  {amGrowthStageLabel(opt)}
                </option>
              ))}
            </select>
          </label>
          <label className="revops-field revops-field--full">
            <span>
              Signal / Evidence <span className="revops-req">*</span>
            </span>
            <textarea
              value={evidence}
              onChange={(ev) => setEvidence(ev.target.value)}
              rows={3}
              placeholder="Dấu hiệu upsell/cross-sell, bằng chứng…"
              required
            />
          </label>
        </div>
      </form>
    </RevOpsModalFrame>
  );
}

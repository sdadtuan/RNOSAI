'use client';

import { useEffect, useState } from 'react';
import { EvidenceIdChip } from '@/components/research/EvidenceIdChip';
import {
  INSIGHT_GATE_COPY,
  INSIGHT_STATUS_LABELS,
  type CreateInsightBody,
  type ResearchEvidence,
  type ResearchInsight,
} from '@/lib/market-research-api';

const BLOCKS = [
  { id: 'observation', label: 'Quan sát' },
  { id: 'interpretation', label: 'Diễn giải' },
  { id: 'implication', label: 'Hệ quả' },
  { id: 'recommendation', label: 'Khuyến nghị' },
] as const;

type BlockId = (typeof BLOCKS)[number]['id'];

const empty = {
  statement: '',
  observation: '',
  interpretation: '',
  implication: '',
  recommendation: '',
  audience: '',
  confidence_rationale: '',
  valid_from: '',
  valid_to: '',
};

export function InsightDrawer({
  open,
  insight,
  evidence,
  canEdit,
  canApprove,
  isCreator,
  saving,
  onClose,
  onSave,
  onSubmitReview,
  onApprove,
}: {
  open: boolean;
  insight: ResearchInsight | null;
  evidence: ResearchEvidence[];
  canEdit: boolean;
  canApprove: boolean;
  isCreator: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (body: CreateInsightBody, evidenceIds: number[]) => Promise<void>;
  onSubmitReview: (body: CreateInsightBody, evidenceIds: number[]) => Promise<void>;
  onApprove: (target: 'approved_internal' | 'approved_client_facing') => Promise<void>;
}) {
  const [form, setForm] = useState(empty);
  const [block, setBlock] = useState<BlockId>('observation');
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => {
    if (!open) return;
    setForm({
      statement: insight?.statement ?? '',
      observation: insight?.observation ?? '',
      interpretation: insight?.interpretation ?? '',
      implication: insight?.implication ?? '',
      recommendation: insight?.recommendation ?? '',
      audience: insight?.audience ?? '',
      confidence_rationale: insight?.confidence_rationale ?? '',
      valid_from: insight?.valid_from ?? '',
      valid_to: insight?.valid_to ?? '',
    });
    setSelected(insight?.evidence_ids ?? []);
    setBlock('observation');
  }, [open, insight]);

  if (!open) return null;

  const verified = evidence.filter((ev) => ev.qc_status === 'verified');
  const verifiedSelected = selected.filter((id) => verified.some((ev) => ev.id === id));
  const submitDisabled = saving || !form.statement.trim() || verifiedSelected.length < 1;
  const showInternalApprove =
    canApprove && !isCreator && (insight?.status === 'analyst_verified' || insight?.status === 'peer_reviewed');
  const showClientApprove = canApprove && !isCreator && insight?.status === 'approved_internal';

  function set<K extends keyof typeof empty>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toBody(): CreateInsightBody {
    return {
      statement: form.statement.trim(),
      observation: form.observation.trim() || null,
      interpretation: form.interpretation.trim() || null,
      implication: form.implication.trim() || null,
      recommendation: form.recommendation.trim() || null,
      audience: form.audience.trim() || null,
      confidence_rationale: form.confidence_rationale.trim() || null,
      valid_from: form.valid_from.trim() || null,
      valid_to: form.valid_to.trim() || null,
    };
  }

  function toggleEvidence(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const title = insight ? `Insight #${insight.id} · ${INSIGHT_STATUS_LABELS[insight.status]}` : 'Insight mới';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20, 28, 20, 0.35)',
        display: 'flex',
        justifyContent: 'flex-end',
        zIndex: 40,
      }}
      onClick={onClose}
    >
      <form
        className="card"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!canEdit) return;
          void onSave(toBody(), selected);
        }}
        style={{
          width: 'min(520px, 100%)',
          height: '100%',
          overflow: 'auto',
          padding: '1rem',
          display: 'grid',
          gap: '0.55rem',
          alignContent: 'start',
          borderRadius: 0,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>{title}</h2>
          <button type="button" className="btn btn-sm btn-secondary" onClick={onClose}>
            Đóng
          </button>
        </div>
        {isCreator ? (
          <p className="muted">Người tạo không tự duyệt — nhờ Research Lead.</p>
        ) : null}
        <label>
          Statement *
          <textarea
            className="kpi-input"
            rows={3}
            required
            value={form.statement}
            disabled={!canEdit}
            onChange={(e) => set('statement', e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {BLOCKS.map((b) => (
            <button
              key={b.id}
              type="button"
              className={block === b.id ? 'btn btn-sm' : 'btn btn-sm btn-secondary'}
              onClick={() => setBlock(b.id)}
            >
              {b.label}
            </button>
          ))}
        </div>
        <label>
          {BLOCKS.find((b) => b.id === block)?.label}
          <textarea
            className="kpi-input"
            rows={4}
            value={form[block]}
            disabled={!canEdit}
            onChange={(e) => set(block, e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        <fieldset style={{ border: '1px solid #d8e0d8', borderRadius: 8, padding: '0.6rem' }}>
          <legend>Evidence đã verify</legend>
          {verified.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              Chưa có evidence verified để gắn.
            </p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {verified.map((ev) => (
                <li key={ev.id} style={{ marginBottom: '0.35rem' }}>
                  <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selected.includes(ev.id)}
                      disabled={!canEdit}
                      onChange={() => toggleEvidence(ev.id)}
                    />
                    <EvidenceIdChip id={ev.id} locator={ev.locator} />
                    <span className="muted" style={{ fontSize: '0.8rem' }}>
                      {ev.excerpt || ev.locator}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
        <label>
          Giải thích độ tin cậy
          <textarea
            className="kpi-input"
            rows={3}
            value={form.confidence_rationale}
            disabled={!canEdit}
            onChange={(e) => set('confidence_rationale', e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        <label>
          Audience
          <input
            className="kpi-input"
            value={form.audience}
            disabled={!canEdit}
            onChange={(e) => set('audience', e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <label>
            Hiệu lực từ
            <input
              className="kpi-input"
              type="date"
              value={form.valid_from}
              disabled={!canEdit}
              onChange={(e) => set('valid_from', e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            />
          </label>
          <label>
            Đến
            <input
              className="kpi-input"
              type="date"
              value={form.valid_to}
              disabled={!canEdit}
              onChange={(e) => set('valid_to', e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            />
          </label>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {canEdit ? (
            <button type="submit" className="btn btn-sm" disabled={saving || !form.statement.trim()}>
              Lưu
            </button>
          ) : null}
          {canEdit ? (
            <button
              type="button"
              className="btn btn-sm"
              disabled={submitDisabled}
              title={verifiedSelected.length < 1 ? INSIGHT_GATE_COPY.missing_verified_evidence : undefined}
              onClick={() => void onSubmitReview(toBody(), selected)}
            >
              Gửi Lead duyệt
            </button>
          ) : null}
          {showInternalApprove ? (
            <button
              type="button"
              className="btn btn-sm"
              disabled={saving}
              onClick={() => void onApprove('approved_internal')}
            >
              Duyệt nội bộ
            </button>
          ) : null}
          {showClientApprove ? (
            <button
              type="button"
              className="btn btn-sm"
              disabled={saving}
              onClick={() => void onApprove('approved_client_facing')}
            >
              Duyệt bản khách
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

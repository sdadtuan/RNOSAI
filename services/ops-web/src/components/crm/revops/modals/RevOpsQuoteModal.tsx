'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import {
  ApiError,
  createDealRoomQuote,
  fetchLeads,
  fetchProposalsByLeadId,
  type LeadRow,
} from '@/lib/api';
import { useToast } from '@/lib/toast';
import { RevOpsModalFrame } from '../RevOpsModalFrame';
import { leadOptionLabel } from '../revops-modal.util';

const TEMPLATES = [
  { value: 'crm_standard', label: 'CRM Enterprise Standard' },
  { value: 'agency_retainer', label: 'Agency Retainer' },
  { value: 'ai_agent', label: 'AI Agent Proposal' },
];

const PRICE_BOOKS = [
  { value: 'enterprise_2026', label: 'Enterprise 2026' },
  { value: 'agency_2026', label: 'Agency Services 2026' },
];

export function RevOpsQuoteModal({
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
  const [leadId, setLeadId] = useState('');
  const [template, setTemplate] = useState(TEMPLATES[0].value);
  const [priceBook, setPriceBook] = useState(PRICE_BOOKS[0].value);
  const [expiry, setExpiry] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !token) return;
    void fetchLeads(token, { limit: 50, lead_flow_kind: 'b2b_prospect' })
      .then((out) => setLeads(out.leads ?? []))
      .catch(() => setLeads([]));
  }, [open, token]);

  useEffect(() => {
    if (!open) return;
    setLeadId(presetLeadId ? String(presetLeadId) : '');
    setTemplate(TEMPLATES[0].value);
    setPriceBook(PRICE_BOOKS[0].value);
    setExpiry('');
    setNote('');
  }, [open, presetLeadId]);

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (saving) return;
    const id = Number(leadId);
    if (!id || !expiry) {
      push('Opportunity và ngày hết hạn báo giá là bắt buộc', 'error');
      return;
    }
    setSaving(true);
    try {
      const existing = await fetchProposalsByLeadId(token, id).catch(() => []);
      await createDealRoomQuote(token, {
        lead_id: id,
        package_tier: template.includes('agency') ? 'standard' : 'premium',
        auto_lines: true,
        notes: [note.trim(), `template=${template}`, `price_book=${priceBook}`, `expiry=${expiry}`]
          .filter(Boolean)
          .join(' | '),
      });
      push(
        existing.length > 0
          ? 'Báo giá draft đã được tạo (lead đã có proposal trước đó).'
          : 'Báo giá draft đã được tạo.',
        'success',
      );
      onClose();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'Không tạo được báo giá', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <RevOpsModalFrame
      open={open}
      title="Tạo báo giá / Proposal"
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="revops-btn" onClick={onClose} disabled={saving}>
            Hủy
          </button>
          <button type="submit" form="revops-quote-form" className="revops-btn revops-btn--primary" disabled={saving}>
            {saving ? 'Đang tạo…' : 'Tạo báo giá'}
          </button>
        </>
      }
    >
      <form id="revops-quote-form" onSubmit={onSubmit}>
        <div className="revops-form-grid">
          <label className="revops-field">
            <span>
              Opportunity / Lead <span className="revops-req">*</span>
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
            <span>Quote template</span>
            <select value={template} onChange={(ev) => setTemplate(ev.target.value)}>
              {TEMPLATES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="revops-field">
            <span>Price book</span>
            <select value={priceBook} onChange={(ev) => setPriceBook(ev.target.value)}>
              {PRICE_BOOKS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="revops-field">
            <span>
              Quote expiry <span className="revops-req">*</span>
            </span>
            <input type="date" value={expiry} onChange={(ev) => setExpiry(ev.target.value)} />
          </label>
          <label className="revops-field revops-field--full">
            <span>Commercial note</span>
            <textarea
              value={note}
              onChange={(ev) => setNote(ev.target.value)}
              placeholder="Điều kiện thanh toán, discount justification..."
              rows={3}
            />
          </label>
        </div>
        <p className="revops-notice">
          Nếu discount vượt hạn mức, hệ thống sẽ tự động tạo approval request.{' '}
          <Link href="/crm/revenue-ops/approvals">Mở Phê duyệt →</Link>
        </p>
      </form>
    </RevOpsModalFrame>
  );
}

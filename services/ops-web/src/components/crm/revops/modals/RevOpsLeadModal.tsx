'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  ApiError,
  createLead,
  fetchLeadLookupOptions,
  type CrmLeadLookupOption,
} from '@/lib/api';
import { useToast } from '@/lib/toast';
import { RevOpsModalFrame } from '../RevOpsModalFrame';

const SOURCE_FALLBACK = [
  { value: 'manual', label: 'Thủ công / Offline' },
  { value: 'website', label: 'Website Form' },
  { value: 'referral', label: 'Referral Partner' },
  { value: 'event', label: 'Event / Webinar' },
];

export function RevOpsLeadModal({
  open,
  token,
  onClose,
  onCreated,
}: {
  open: boolean;
  token: string;
  onClose: () => void;
  onCreated?: (leadId: number) => void;
}) {
  const { push } = useToast();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [source, setSource] = useState('manual');
  const [channel, setChannel] = useState('');
  const [note, setNote] = useState('');
  const [sourceOptions, setSourceOptions] = useState<CrmLeadLookupOption[]>([]);
  const [channelOptions, setChannelOptions] = useState<CrmLeadLookupOption[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !token) return;
    void Promise.all([
      fetchLeadLookupOptions(token, 'source').catch(() => ({ options: [] })),
      fetchLeadLookupOptions(token, 'channel').catch(() => ({ options: [] })),
    ]).then(([src, ch]) => {
      setSourceOptions(src.options ?? []);
      setChannelOptions(ch.options ?? []);
    });
  }, [open, token]);

  useEffect(() => {
    if (!open) return;
    setFullName('');
    setPhone('');
    setEmail('');
    setSource('manual');
    setChannel('');
    setNote('');
  }, [open]);

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (saving) return;
    if (!fullName.trim() || !phone.trim()) {
      push('Họ tên và điện thoại là bắt buộc', 'error');
      return;
    }
    setSaving(true);
    try {
      const lead = await createLead(token, {
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        source: source || 'manual',
        channel: channel || undefined,
        status: 'moi',
        lead_flow_kind: 'b2b_prospect',
      });
      push('Lead đã được tạo. Duplicate check và routing đang xử lý.', 'success');
      onCreated?.(lead.id);
      onClose();
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'Không tạo được lead', 'error');
    } finally {
      setSaving(false);
    }
  }

  const sources =
    sourceOptions.length > 0
      ? sourceOptions.map((o) => ({ value: o.option_key, label: o.label }))
      : SOURCE_FALLBACK;

  return (
    <RevOpsModalFrame
      open={open}
      title="Tạo Lead"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="revops-btn" onClick={onClose} disabled={saving}>
            Hủy
          </button>
          <button type="submit" form="revops-lead-form" className="revops-btn revops-btn--primary" disabled={saving}>
            {saving ? 'Đang lưu…' : 'Lưu & chạy routing'}
          </button>
        </>
      }
    >
      <form id="revops-lead-form" onSubmit={onSubmit}>
        <p className="revops-notice">
          Hệ thống sẽ chạy duplicate check, lead scoring và routing sau khi lưu.
        </p>
        <div className="revops-form-grid">
          <label className="revops-field">
            <span>
              Họ và tên <span className="revops-req">*</span>
            </span>
            <input value={fullName} onChange={(ev) => setFullName(ev.target.value)} placeholder="Nguyễn Văn Minh" />
          </label>
          <label className="revops-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              placeholder="email@company.vn"
            />
          </label>
          <label className="revops-field">
            <span>
              Điện thoại <span className="revops-req">*</span>
            </span>
            <input value={phone} onChange={(ev) => setPhone(ev.target.value)} placeholder="0909 123 456" />
          </label>
          <label className="revops-field">
            <span>
              Nguồn lead <span className="revops-req">*</span>
            </span>
            <select value={source} onChange={(ev) => setSource(ev.target.value)}>
              {sources.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="revops-field">
            <span>Kênh</span>
            <select value={channel} onChange={(ev) => setChannel(ev.target.value)}>
              <option value="">—</option>
              {channelOptions.map((o) => (
                <option key={o.option_key} value={o.option_key}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="revops-field revops-field--full">
            <span>Ghi chú nhu cầu</span>
            <textarea
              value={note}
              onChange={(ev) => setNote(ev.target.value)}
              placeholder="Mô tả nhu cầu, ngân sách, timeline..."
              rows={3}
            />
          </label>
        </div>
      </form>
    </RevOpsModalFrame>
  );
}

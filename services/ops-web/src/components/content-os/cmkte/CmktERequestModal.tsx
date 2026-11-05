'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { getAccessToken } from '@/lib/auth';
import type { ContentRequestCreated } from '@/lib/crm/cmkte-request-form';
import { readLastLifecycleId, resolveRequestLifecycleId, submitRequestForm } from '@/lib/crm/cmkte-request-form';

const SOURCES = [
  { value: 'account', label: 'Account team' },
  { value: 'client_portal', label: 'Client Portal' },
  { value: 'campaign', label: 'Campaign' },
  { value: 'api', label: 'API' },
  { value: 'idea', label: 'Idea' },
] as const;

const PRIORITIES = ['High', 'Standard', 'Regulated'] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (request: ContentRequestCreated) => void;
  lifecycleId?: number;
};

const EMPTY = {
  client: '',
  source: 'account',
  deliverable: '',
  objective: '',
  due: '',
  priority: 'Standard',
  lifecycle_id: '',
  brand_id: '',
  locale: '',
};

export function CmktERequestModal({ open, onClose, onCreated, lifecycleId }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    setBusy(false);
    const search =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('lifecycle') : null;
    const resolved = resolveRequestLifecycleId({
      explicit: lifecycleId,
      search,
      stored: readLastLifecycleId(),
    });
    setForm({
      ...EMPTY,
      lifecycle_id: resolved ? String(resolved) : '',
    });
  }, [open, lifecycleId]);

  if (!open) return null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const token = getAccessToken();
    if (!token) {
      setError('Thiếu phiên đăng nhập — không tạo request.');
      return;
    }
    setBusy(true);
    setError('');
    const out = await submitRequestForm({
      client: form.client,
      source: form.source,
      deliverable: form.deliverable,
      objective: form.objective,
      due: form.due,
      priority: form.priority,
      lifecycle_id: Number(form.lifecycle_id),
      brand_id: form.brand_id,
      locale: form.locale,
      token,
    });
    setBusy(false);
    if ('error' in out) {
      setError(out.error);
      return;
    }
    onCreated?.(out.request);
    onClose();
  }

  return (
    <div className="cmkte-modalback" role="presentation" onClick={onClose}>
      <div
        className="cmkte-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cmkte-request-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="cmkte-request-modal-title">Tạo Content Request</h2>
        <p className="cmkte-desc">Intake chuẩn — hệ thống tính completeness và mở triage.</p>
        <form onSubmit={onSubmit}>
          <div className="cmkte-grid2">
            <label className="cmkte-field">
              <span>
                Client / Brand <span className="cmkte-req">*</span>
              </span>
              <input
                className="cmkte-input"
                value={form.client}
                onChange={(e) => setForm((f) => ({ ...f, client: e.target.value }))}
                autoComplete="off"
              />
            </label>
            <label className="cmkte-field">
              <span>
                Nguồn <span className="cmkte-req">*</span>
              </span>
              <select
                className="cmkte-input"
                value={form.source}
                onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
              >
                {SOURCES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="cmkte-field">
            <span>
              Deliverable yêu cầu <span className="cmkte-req">*</span>
            </span>
            <input
              className="cmkte-input"
              value={form.deliverable}
              onChange={(e) => setForm((f) => ({ ...f, deliverable: e.target.value }))}
            />
          </label>
          <label className="cmkte-field">
            <span>
              Objective <span className="cmkte-req">*</span>
            </span>
            <input
              className="cmkte-input"
              value={form.objective}
              onChange={(e) => setForm((f) => ({ ...f, objective: e.target.value }))}
            />
          </label>
          <div className="cmkte-grid2">
            <label className="cmkte-field">
              <span>
                Due date <span className="cmkte-req">*</span>
              </span>
              <input
                className="cmkte-input"
                type="date"
                value={form.due}
                onChange={(e) => setForm((f) => ({ ...f, due: e.target.value }))}
              />
            </label>
            <label className="cmkte-field">
              <span>
                Priority <span className="cmkte-req">*</span>
              </span>
              <select
                className="cmkte-input"
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              >
                {PRIORITIES.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="cmkte-grid2">
            <label className="cmkte-field">
              <span>
                Brand ID <span className="cmkte-req">*</span>
              </span>
              <input
                className="cmkte-input"
                value={form.brand_id}
                onChange={(e) => setForm((f) => ({ ...f, brand_id: e.target.value }))}
                autoComplete="off"
              />
            </label>
            <label className="cmkte-field">
              <span>
                Locale <span className="cmkte-req">*</span>
              </span>
              <input
                className="cmkte-input"
                value={form.locale}
                onChange={(e) => setForm((f) => ({ ...f, locale: e.target.value }))}
                autoComplete="off"
                placeholder="vi-VN"
              />
            </label>
          </div>
          <label className="cmkte-field">
            <span>
              Lifecycle ID <span className="cmkte-req">*</span>
            </span>
            <input
              className="cmkte-input"
              type="number"
              min={1}
              step={1}
              value={form.lifecycle_id}
              onChange={(e) => setForm((f) => ({ ...f, lifecycle_id: e.target.value }))}
            />
          </label>
          {error ? <p className="cmkte-form-error">{error}</p> : null}
          <div className="cmkte-actions cmkte-actions--end">
            <button type="button" className="cmkte-btn" onClick={onClose} disabled={busy}>
              Hủy
            </button>
            <button type="submit" className="cmkte-btn cmkte-btn--blue" disabled={busy}>
              Tạo và mở triage
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

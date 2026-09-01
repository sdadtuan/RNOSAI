'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { CsdEmailInbox } from '@/components/crm/csd/CsdEmailInbox';
import { useCsdPageAuth } from '@/components/crm/csd/useCsdPageAuth';
import { fetchCsdEmails, sendCsdEmail, type CsdEmailRow } from '@/lib/crm/csd-api';

export default function CsdEmailPage() {
  const { user, token, error, setError, logout, canWrite } = useCsdPageAuth('view');
  const [items, setItems] = useState<CsdEmailRow[]>([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const [form, setForm] = useState({ to: '', subject: '', body_text: '' });
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!token) return;
    try {
      const out = await fetchCsdEmails(token);
      setItems(out.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải email thất bại');
    }
  }, [token, setError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !canWrite) return;
    setBusy(true);
    try {
      await sendCsdEmail(token, {
        to: form.to.split(',').map((s) => s.trim()).filter(Boolean),
        subject: form.subject,
        body_text: form.body_text,
      });
      setComposeOpen(false);
      setForm({ to: '', subject: '', body_text: '' });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gửi email thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <StaffPageShell user={null} onLogout={logout} loading>
        <span />
      </StaffPageShell>
    );
  }

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      breadcrumb={[
        { label: 'CRM', href: '/crm/leads' },
        { label: 'Service Desk', href: '/crm/csd' },
        { label: 'Email' },
      ]}
    >
      <PageToolbar title="Hộp thư dùng chung" subtitle="Inbound IMAP → ticket · compose có duyệt từ khoá" />
      <div className="page-card stack-gap">
        {error ? <p className="error">{error}</p> : null}
        <CsdEmailInbox
          items={items}
          unmatchedHref="/crm/csd/email/unmatched"
          onCompose={canWrite ? () => setComposeOpen(true) : undefined}
        />
      </div>

      {composeOpen ? (
        <div className="csd-modal-backdrop" role="presentation" onClick={() => setComposeOpen(false)}>
          <form className="csd-modal page-card stack-gap" onSubmit={(e) => void handleSend(e)} onClick={(e) => e.stopPropagation()}>
            <h3 className="kpi-section-title">Soạn email</h3>
            <input className="kpi-input" placeholder="Đến (phân cách bằng dấu phẩy)" required value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
            <input className="kpi-input" placeholder="Tiêu đề" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            <textarea className="kpi-input" rows={6} placeholder="Nội dung" required value={form.body_text} onChange={(e) => setForm({ ...form, body_text: e.target.value })} />
            <div className="csd-composer__actions">
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => setComposeOpen(false)}>Huỷ</button>
              <button type="submit" className="btn btn-sm" disabled={busy}>Gửi</button>
            </div>
          </form>
        </div>
      ) : null}
    </StaffPageShell>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { CsdTicketList } from '@/components/crm/csd/CsdTicketList';
import { useCsdPageAuth } from '@/components/crm/csd/useCsdPageAuth';
import {
  createCsdTicket,
  fetchCsdTickets,
  CSD_PRIORITY_LABELS,
  CSD_TICKET_TYPES,
  type CsdPriority,
  type CsdTicketRow,
} from '@/lib/crm/csd-api';

export default function CsdTicketsPage() {
  const router = useRouter();
  const { user, token, error, setError, logout, canWrite } = useCsdPageAuth('view');
  const [items, setItems] = useState<CsdTicketRow[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    ticket_type: 'request',
    priority: 'P3' as CsdPriority,
  });

  const reload = useCallback(async () => {
    if (!token) return;
    try {
      const out = await fetchCsdTickets(token, q ? { q } : {});
      setItems(out.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải ticket thất bại');
    }
  }, [token, q, setError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !canWrite) return;
    setBusy(true);
    setError('');
    try {
      const created = await createCsdTicket(token, form);
      setForm({ title: '', description: '', ticket_type: 'request', priority: 'P3' });
      router.push(`/crm/csd/tickets/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo ticket thất bại');
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
        { label: 'Ticket' },
      ]}
    >
      <PageToolbar
        title="Ticket Service Desk"
        subtitle="Ticket agency có SLA — không phải Ticket CS (/crm/tickets)"
      />

      <div className="page-card stack-gap">
        {error ? <p className="error">{error}</p> : null}

        <div className="kpi-page__filters">
          <input
            className="kpi-input"
            placeholder="Tìm mã / tiêu đề"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-testid="csd-ticket-search"
          />
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => void reload()}>
            Lọc
          </button>
        </div>

        {canWrite ? (
          <form onSubmit={(e) => void handleCreate(e)} className="admin-crm-form" data-testid="csd-ticket-create">
            <h3 className="kpi-section-title">Tạo ticket mới</h3>
            <div className="admin-crm-form__grid">
              <input
                className="kpi-input"
                placeholder="Tiêu đề"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <select
                className="kpi-select"
                value={form.ticket_type}
                onChange={(e) => setForm({ ...form, ticket_type: e.target.value })}
              >
                {CSD_TICKET_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <select
                className="kpi-select"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as CsdPriority })}
              >
                {(Object.keys(CSD_PRIORITY_LABELS) as CsdPriority[]).map((p) => (
                  <option key={p} value={p}>
                    {CSD_PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              className="kpi-input"
              rows={3}
              placeholder="Mô tả"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              style={{ width: '100%', marginBottom: '0.75rem' }}
            />
            <button type="submit" className="btn btn-sm" disabled={busy}>
              {busy ? 'Đang tạo…' : 'Tạo ticket'}
            </button>
          </form>
        ) : (
          <p className="muted">Chế độ chỉ xem — cần quyền csd:write để tạo ticket.</p>
        )}

        <CsdTicketList items={items} onSelect={(row) => router.push(`/crm/csd/tickets/${row.id}`)} />
      </div>
    </StaffPageShell>
  );
}

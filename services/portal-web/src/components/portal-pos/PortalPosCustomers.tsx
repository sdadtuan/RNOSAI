'use client';

import { useCallback, useEffect, useState } from 'react';
import { POS_STATUS_LABEL, posGet, posPost, vnd, type PosRisk } from '@/lib/portal-pos-api';

type Row = {
  id: string; phone: string; name: string; address: string; blacklist: boolean;
  order_count: number; success_count: number; returned_count: number; revenue_vnd: number; risk: PosRisk;
};

export function PortalPosCustomers({ token, canManage, initialPhone }: { token: string; canManage: boolean; initialPhone?: string }) {
  const [q, setQ] = useState(initialPhone ?? '');
  const [data, setData] = useState<{ total: number; customers: Row[] } | null>(null);
  const [open, setOpen] = useState<string>(initialPhone ?? '');
  const [profile, setProfile] = useState<{
    phone: string; customer: Row | null; risk: PosRisk; success: number; returned: number;
    orders: Array<{ id: string; code: string; status: string; total_vnd: number; created_at: string }>;
    conversations: Array<{ id: string; title: string; page_id: string; status: string; kind: string }>;
    leads: Array<{ id: string; full_name: string; phone: string; campaign_name: string }>;
  } | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await posGet<{ total: number; customers: Row[] }>(token, `/api/portal/pos/customers?q=${encodeURIComponent(q)}`);
    setData(res);
  }, [token, q]);

  useEffect(() => { void load().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Lỗi')); }, [load]);

  async function openPhone(phone: string) {
    setOpen(phone);
    const res = await posGet<NonNullable<typeof profile>>(token, `/api/portal/pos/customers/${encodeURIComponent(phone)}`);
    setProfile(res);
  }

  useEffect(() => { if (initialPhone) void openPhone(initialPhone); }, [initialPhone]); // eslint-disable-line

  return (
    <div className="pos">
      <header className="pos__head">
        <div>
          <h1>Khách hàng</h1>
          <p>Hồ sơ theo số điện thoại: đơn, hội thoại, lead, tỷ lệ hoàn và danh sách hạn chế.</p>
        </div>
      </header>
      {error ? <p className="pos-error">{error}</p> : null}
      <div className="pos-filters">
        <input className="pos-input" placeholder="Tìm tên hoặc số điện thoại" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="pos-grid pos-grid--2">
        <table className="pos-table">
          <thead><tr><th>Khách</th><th>Đơn</th><th>Doanh thu</th><th>Cảnh báo</th></tr></thead>
          <tbody>
            {(data?.customers ?? []).map((c) => (
              <tr key={c.id} onClick={() => void openPhone(c.phone)} className={open === c.phone ? 'is-on' : ''}>
                <td><strong>{c.name || 'Khách'}</strong><div className="pos-hint">{c.phone}</div></td>
                <td>{c.order_count} <span className="pos-hint">({c.success_count} OK / {c.returned_count} hoàn)</span></td>
                <td>{vnd(c.revenue_vnd)}</td>
                <td>{c.risk.level !== 'ok' ? <span className={`pos-badge pos-badge--${c.risk.level}`}>{c.blacklist ? 'Hạn chế' : 'Hoàn cao'}</span> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pos-card">
          {!profile ? <p className="pos-hint">Chọn một khách để xem hồ sơ.</p> : (
            <>
              <h2>{profile.customer?.name || 'Khách'} · {profile.phone}</h2>
              {profile.risk.level !== 'ok' ? <div className={`pos-warn ${profile.risk.level === 'block' ? 'is-block' : ''}`}>{profile.risk.message}</div> : null}
              <p className="pos-hint">{profile.success} đơn thành công · {profile.returned} hoàn · {(profile.risk.return_rate * 100).toFixed(0)}% hoàn</p>
              {canManage ? (
                <button type="button" className="pos-btn pos-btn--sm pos-btn--danger" onClick={() => void posPost(token, `/api/portal/pos/customers/${encodeURIComponent(profile.phone)}/blacklist`, { blacklist: !profile.customer?.blacklist }).then(() => openPhone(profile.phone))}>
                  {profile.customer?.blacklist ? 'Bỏ hạn chế' : 'Đưa vào danh sách hạn chế'}
                </button>
              ) : null}
              <h3 style={{ marginTop: 16 }}>Đơn hàng</h3>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {profile.orders.map((o) => (
                  <li key={o.id} style={{ padding: '4px 0' }}>
                    <a href={`/client/crm/orders/${o.id}`}>{o.code}</a> <span className={`pos-badge pos-badge--${o.status}`}>{POS_STATUS_LABEL[o.status] || o.status}</span> {vnd(o.total_vnd)}
                  </li>
                ))}
              </ul>
              <h3>Hội thoại</h3>
              {profile.conversations.length ? profile.conversations.map((c) => (
                <p key={c.id} className="pos-hint">{c.title} · {c.kind} · {c.status}</p>
              )) : <p className="pos-hint">Không có hội thoại trùng số.</p>}
              <h3>Lead</h3>
              {profile.leads.length ? profile.leads.map((l) => (
                <p key={l.id} className="pos-hint">{l.full_name || 'Lead'} · {l.campaign_name}</p>
              )) : <p className="pos-hint">Không có lead trùng số.</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

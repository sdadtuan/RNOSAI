'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { claimLeadSalesReceipt } from '@/lib/api';
import { isApiUnauthorized, noteBackgroundUnauthorized, staffTokenForBackground } from '@/lib/crm/staff-session';
import {
  fetchStaffNotifications,
  markStaffNotificationRead,
  type StaffNotificationRow,
} from '@/lib/hr-api';

function metaAction(n: StaffNotificationRow): { action: string; leadId: number | null } {
  const meta = n.meta_json ?? {};
  const action = String(meta.action ?? '').trim();
  const leadIdRaw = Number(meta.lead_id);
  const leadId = Number.isFinite(leadIdRaw) && leadIdRaw > 0 ? leadIdRaw : null;
  return { action, leadId };
}

export function StaffNotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [rows, setRows] = useState<StaffNotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimMsg, setClaimMsg] = useState('');

  const reload = useCallback(async () => {
    const token = await staffTokenForBackground();
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchStaffNotifications(token, { limit: 20 });
      setRows(data.notifications);
      setUnread(data.unread);
    } catch (err) {
      if (isApiUnauthorized(err)) noteBackgroundUnauthorized(token);
      setRows([]);
      setUnread(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    const id = window.setInterval(() => void reload(), 60_000);
    return () => window.clearInterval(id);
  }, [reload]);

  async function onMarkRead(id: string) {
    const token = getAccessToken();
    if (!token) return;
    await markStaffNotificationRead(token, id);
    await reload();
  }

  async function onClaimLead(n: StaffNotificationRow, leadId: number) {
    const token = getAccessToken();
    if (!token) return;
    setClaimingId(n.id);
    setClaimMsg('');
    try {
      await claimLeadSalesReceipt(token, leadId);
      await markStaffNotificationRead(token, n.id);
      setClaimMsg('Đã nhận lead #' + leadId + '.');
      await reload();
    } catch (err) {
      setClaimMsg(err instanceof Error ? err.message : 'Không nhận được lead.');
    } finally {
      setClaimingId(null);
    }
  }

  return (
    <div className="staff-notif-bell">
      <button
        type="button"
        className="btn btn-sm btn-secondary staff-notif-bell__trigger"
        aria-label={`Thông báo${unread ? ` (${unread} chưa đọc)` : ''}`}
        onClick={() => {
          setOpen((v) => !v);
          void reload();
        }}
      >
        🔔
        {unread > 0 ? <span className="staff-notif-bell__badge">{unread}</span> : null}
      </button>
      {open ? (
        <div className="staff-notif-bell__panel" role="dialog" aria-label="Thông báo staff">
          <div className="staff-notif-bell__head">
            <strong>Thông báo</strong>
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => setOpen(false)}>
              Đóng
            </button>
          </div>
          {loading ? <p className="muted">Đang tải…</p> : null}
          {claimMsg ? <p className="staff-notif-bell__msg">{claimMsg}</p> : null}
          <ul className="staff-notif-bell__list">
            {rows.length ? (
              rows.map((n) => {
                const { action, leadId } = metaAction(n);
                const showClaim = action === 'claim_lead' && leadId != null && !n.read;
                return (
                <li key={n.id} className={n.read ? 'is-read' : 'is-unread'}>
                  <div>
                    <strong>{n.title}</strong>
                    {n.kind === 'mkt_ai_kpi_drift' ? (
                      <small className="staff-notif-bell__kind"> · KPI drift</small>
                    ) : null}
                    {n.body ? <p>{n.body}</p> : null}
                    <small>{new Date(n.created_at).toLocaleString('vi-VN')}</small>
                  </div>
                  <div className="staff-notif-bell__actions">
                    {showClaim ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        disabled={claimingId === n.id}
                        onClick={() => void onClaimLead(n, leadId)}
                      >
                        {claimingId === n.id ? 'Đang nhận…' : 'Nhận lead'}
                      </button>
                    ) : null}
                    {n.link_href ? (
                      <Link href={n.link_href} className="btn btn-sm" onClick={() => setOpen(false)}>
                        Mở
                      </Link>
                    ) : null}
                    {!n.read ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() => void onMarkRead(n.id)}
                      >
                        Đã đọc
                      </button>
                    ) : null}
                  </div>
                </li>
                );
              })
            ) : (
              <li className="muted">Không có thông báo.</li>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

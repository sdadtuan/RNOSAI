'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getAccessToken, getStoredUser } from '@/lib/auth';
import { isAccountManager } from '@/lib/crm/lead-ae-visibility';
import { claimLeadSalesReceipt, claimLeadSolution } from '@/lib/api';
import { isApiUnauthorized, noteBackgroundUnauthorized, staffTokenForBackground } from '@/lib/crm/staff-session';
import {
  fetchStaffNotifications,
  markAllStaffNotificationsRead,
  markStaffNotificationRead,
  type StaffNotificationRow,
} from '@/lib/hr-api';
import { staffNotifyClaimKind, staffNotifyLeadId } from './staff-notification-claim.util';
import { formatStaffNotificationAt, stripNotificationOpenLeadPath } from '@/lib/crm/staff-notification-format.util';

export function StaffNotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [rows, setRows] = useState<StaffNotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimMsg, setClaimMsg] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const readIdsRef = useRef<Set<string>>(new Set());

  const reload = useCallback(async () => {
    const token = await staffTokenForBackground();
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchStaffNotifications(token, { unread: true, limit: 20 });
      const hidden = readIdsRef.current;
      const visible = data.notifications.filter((row) => !hidden.has(row.id));
      const stillUnread = data.notifications.length - visible.length;
      setRows(visible);
      setUnread(Math.max(0, data.unread - stillUnread));
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

  useEffect(() => {
    if (!open) return undefined;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function persistRead(id: string) {
    const token = (await staffTokenForBackground()) || getAccessToken();
    if (!token) throw new Error('missing token');
    try {
      await markStaffNotificationRead(token, id);
    } catch (err) {
      if (!isApiUnauthorized(err)) throw err;
      const refreshed = await staffTokenForBackground();
      if (!refreshed || refreshed === token) throw err;
      await markStaffNotificationRead(refreshed, id);
    }
  }

  async function dismissNotification(id: string) {
    readIdsRef.current.add(id);
    setRows((prev) => prev.filter((row) => row.id !== id));
    setUnread((count) => Math.max(0, count - 1));
    try {
      await persistRead(id);
    } catch {
      readIdsRef.current.delete(id);
      void reload();
    }
  }

  async function dismissAll() {
    const snapshot = rows.map((row) => row.id);
    for (const id of snapshot) readIdsRef.current.add(id);
    setRows([]);
    setUnread(0);
    const token = (await staffTokenForBackground()) || getAccessToken();
    if (!token) return;
    try {
      await markAllStaffNotificationsRead(token);
    } catch {
      for (const id of snapshot) readIdsRef.current.delete(id);
      void reload();
    }
  }

  async function onClaimLead(n: StaffNotificationRow, leadId: number) {
    const token = getAccessToken();
    if (!token) return;
    setClaimingId(n.id);
    setClaimMsg('');
    try {
      await claimLeadSalesReceipt(token, leadId);
      await dismissNotification(n.id);
      setClaimMsg('Đã nhận lead #' + leadId + '.');
      await reload();
    } catch (err) {
      setClaimMsg(err instanceof Error ? err.message : 'Không nhận được lead.');
    } finally {
      setClaimingId(null);
    }
  }

  async function onClaimCase(n: StaffNotificationRow, leadId: number) {
    const token = getAccessToken();
    if (!token) return;
    setClaimingId(n.id);
    setClaimMsg('');
    try {
      await claimLeadSolution(token, leadId);
      await dismissNotification(n.id);
      setClaimMsg('Đã nhận case #' + leadId + '.');
      await reload();
    } catch (err) {
      setClaimMsg(err instanceof Error ? err.message : 'Không nhận được case.');
    } finally {
      setClaimingId(null);
    }
  }

  return (
    <div className="staff-notif-bell" ref={rootRef}>
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
            <span style={{ display: 'flex', gap: 6 }}>
              {rows.length ? (
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => void dismissAll()}>
                  Đã đọc tất cả
                </button>
              ) : null}
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => setOpen(false)}>
                Đóng
              </button>
            </span>
          </div>
          {loading ? <p className="muted">Đang tải…</p> : null}
          {claimMsg ? <p className="staff-notif-bell__msg">{claimMsg}</p> : null}
          <ul className="staff-notif-bell__list">
            {rows.length ? (
              rows.map((n) => {
                const leadId = staffNotifyLeadId(n);
                const claimKind = staffNotifyClaimKind(n);
                const hideSalesClaim = isAccountManager(getStoredUser());
                return (
                <li key={n.id} className={n.read ? 'is-read' : 'is-unread'}>
                  <div>
                    <strong>{n.title}</strong>
                    {n.kind === 'mkt_ai_kpi_drift' ? (
                      <small className="staff-notif-bell__kind"> · KPI drift</small>
                    ) : null}
                    {n.body ? <p>{stripNotificationOpenLeadPath(n.body)}</p> : null}
                    <small>{formatStaffNotificationAt(n.created_at)}</small>
                  </div>
                  <div className="staff-notif-bell__actions">
                    {claimKind === 'claim_lead' && leadId != null && !hideSalesClaim ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        disabled={claimingId === n.id}
                        onClick={() => void onClaimLead(n, leadId)}
                      >
                        {claimingId === n.id ? 'Đang nhận…' : 'Nhận lead'}
                      </button>
                    ) : null}
                    {claimKind === 'claim_case' && leadId != null ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        data-testid="staff-notif-claim-case"
                        disabled={claimingId === n.id}
                        onClick={() => void onClaimCase(n, leadId)}
                      >
                        {claimingId === n.id ? 'Đang nhận…' : 'Nhận case'}
                      </button>
                    ) : null}
                    {n.link_href ? (
                      <Link
                        href={n.link_href}
                        className="btn btn-sm"
                        onClick={() => {
                          setOpen(false);
                          void dismissNotification(n.id);
                        }}
                      >
                        Mở
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => void dismissNotification(n.id)}
                    >
                      Đã đọc
                    </button>
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

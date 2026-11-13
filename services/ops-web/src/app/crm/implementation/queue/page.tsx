'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { claimLeadImplementation, fetchImplementationQueue, staffMe, staffRefresh, type ImplementationQueueRow } from '@/lib/api';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';
import { isMarketingLeader } from '@/lib/crm/lead-ae-visibility';
import { ActionErrorToast, ActionSuccessToast } from '@/components/ui/ActionToast';

export default function CrmImplementationQueuePage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [rows, setRows] = useState<ImplementationQueueRow[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyLeadId, setBusyLeadId] = useState<number | null>(null);
  const canClaim = Boolean(user && isMarketingLeader(user));

  const ensureAuth = useCallback(async (): Promise<string | null> => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return null;
    }
    const cached = getStoredUser();
    if (cached) setUser(cached);
    try {
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      return access;
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return null;
      }
      try {
        const out = await staffRefresh(refresh);
        updateAccessToken(out.access_token);
        const me = await staffMe(out.access_token);
        setUser(me);
        updateStoredUser(me);
        return out.access_token;
      } catch {
        clearSession();
        router.replace('/login');
        return null;
      }
    }
  }, [router]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    const token = await ensureAuth();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const out = await fetchImplementationQueue(token, { status: 'pending', limit: 100 });
      setRows(out.rows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải hàng chờ Triển khai thất bại');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [ensureAuth]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  async function onClaim(leadId: number) {
    const token = getAccessToken();
    if (!token) return;
    setBusyLeadId(leadId);
    setMessage('');
    setError('');
    try {
      await claimLeadImplementation(token, leadId);
      setMessage(`Đã nhận case Triển khai Lead #${leadId}`);
      await loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nhận case thất bại');
    } finally {
      setBusyLeadId(null);
    }
  }

  return (
    <StaffPageShell user={user} onLogout={logout}>
      <PageToolbar
        title="Hàng chờ Triển khai (MKL)"
        subtitle="Lead đã GDKD duyệt hợp đồng — Marketing Leader nhận case trong 15 phút."
      />
      <ActionErrorToast message={error} />
      <ActionSuccessToast message={message} />
      {loading ? <p>Đang tải…</p> : null}
      {!loading && rows.length === 0 ? <p>Không có case Triển khai đang chờ.</p> : null}
      <ul className="solution-queue-list">
        {rows.map((row) => (
          <li key={row.lead_id} className="solution-queue-item">
            <div>
              <Link href={`/crm/leads/${row.lead_id}`} className="font-medium">
                {row.full_name || `Lead #${row.lead_id}`}
              </Link>
              <div className="text-sm text-muted">
                Sale: {row.owner_name || '—'} · Hạn nhận: {row.implementation_accept_due_at || '—'}
              </div>
            </div>
            {canClaim && row.implementation_handoff_status === 'pending' ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={busyLeadId === row.lead_id}
                onClick={() => void onClaim(row.lead_id)}
              >
                Nhận case
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </StaffPageShell>
  );
}

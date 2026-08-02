'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CrmHrPageShell } from '@/components/crm/CrmHrPageShell';
import { DetailPageLayout } from '@/components/layout';
import { fetchCrmStaffWorkspace, staffMe, staffRefresh } from '@/lib/api';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  hasCap,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';

export default function CrmStaffDetailPage() {
  const router = useRouter();
  const params = useParams();
  const staffId = Number(params.id);
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [bundle, setBundle] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

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
      if (!hasCap(me, 'crm_staff_roster', 'view')) {
        setError('Không có quyền');
        return null;
      }
      return access;
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return null;
      }
      const out = await staffRefresh(refresh);
      updateAccessToken(out.access_token);
      access = out.access_token;
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      return access;
    }
  }, [router]);

  useEffect(() => {
    if (!Number.isFinite(staffId) || staffId <= 0) {
      setError('ID không hợp lệ');
      setLoading(false);
      return;
    }
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      setLoading(true);
      try {
        setBundle(await fetchCrmStaffWorkspace(access, staffId));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải workspace thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, staffId]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  const staff = (bundle?.staff as Record<string, unknown>) ?? {};
  const stats = (bundle?.stats as Record<string, number>) ?? {};
  const cases = (bundle?.cases as Array<{ id: number; title: string; status_label?: string }>) ?? [];

  if (!user) {
    return (
      <CrmHrPageShell user={null} onLogout={logout} title="Nhân viên" hideToolbar loading>
        <span />
      </CrmHrPageShell>
    );
  }

  return (
    <CrmHrPageShell
      user={user}
      onLogout={logout}
      title={String(staff.name ?? `#${staffId}`)}
      hideToolbar
      breadcrumb={[
        { label: 'CRM', href: '/crm/leads' },
        { label: 'Nhân sự', href: '/crm/staff' },
        { label: String(staff.name ?? `#${staffId}`) },
      ]}
    >
      <DetailPageLayout
        backHref="/crm/staff"
        backLabel="← Nhân viên"
        title={`${String(staff.name ?? `#${staffId}`)} · ${String(staff.job_title ?? '')}`}
        subtitle={
          bundle
            ? `Case mở ${stats.open ?? 0} · Ưu tiên cao ${stats.high_priority ?? 0} · SLA quá hạn ${stats.sla_overdue ?? 0}`
            : undefined
        }
      >
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {bundle && !loading ? (
          cases.length === 0 ? (
            <p className="muted">Chưa có case gán.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
              {cases.slice(0, 15).map((c) => (
                <li key={c.id}>
                  #{c.id} · {c.title} {c.status_label ? `— ${c.status_label}` : ''}
                </li>
              ))}
            </ul>
          )
        ) : null}
      </DetailPageLayout>
    </CrmHrPageShell>
  );
}

'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CrmDeliveryPageShell } from '@/components/crm/CrmDeliveryPageShell';
import { fetchServiceLifecycles, staffMe, staffRefresh, type ServiceLifecycleRow } from '@/lib/api';
import {
  canViewContentOs,
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';
import { isContentMarketingFeEnabled } from '@/lib/content-marketing-flags';
import { contentOsBoardHref, filterContentOsLifecycles } from '@/lib/crm/content-os-hub.util';

const EMPTY_COPY = 'Chưa có lifecycle Content Marketing. Mở Triển khai DV để tạo, rồi quay lại đây.';

export default function CrmContentOsHubPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [rows, setRows] = useState<ServiceLifecycleRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      if (!canViewContentOs(me)) {
        setError('Không có quyền Content Marketing OS');
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
      try {
        const out = await staffRefresh(refresh);
        updateAccessToken(out.access_token);
        access = out.access_token;
        const me = await staffMe(access);
        setUser(me);
        updateStoredUser(me);
        if (!canViewContentOs(me)) {
          setError('Không có quyền Content Marketing OS');
          return null;
        }
        return access;
      } catch {
        clearSession();
        router.replace('/login');
        return null;
      }
    }
  }, [router]);

  useEffect(() => {
    void (async () => {
      let access: string | null = null;
      try {
        access = await ensureAuth();
      } catch {
        clearSession();
        router.replace('/login');
        return;
      }
      if (!access || !isContentMarketingFeEnabled()) return;
      setLoading(true);
      setError('');
      try {
        const data = await fetchServiceLifecycles(access, { include_draft: true });
        setRows(filterContentOsLifecycles(data.lifecycles ?? []));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải Content Marketing OS thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, router]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (!user) {
    return (
      <CrmDeliveryPageShell user={null} onLogout={logout} title="Content Marketing OS" loading>
        <span />
      </CrmDeliveryPageShell>
    );
  }

  if (!isContentMarketingFeEnabled()) {
    return (
      <CrmDeliveryPageShell user={user} onLogout={logout} title="Content Marketing OS">
        <div className="page-card">
          <p>Module tắt</p>
        </div>
      </CrmDeliveryPageShell>
    );
  }

  return (
    <CrmDeliveryPageShell
      user={user}
      onLogout={logout}
      title="Content Marketing OS"
      subtitle="Chọn lifecycle để mở Content Board"
    >
      <div className="page-card stack-gap">
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}

        {!loading && !error && rows.length === 0 ? <p className="muted">{EMPTY_COPY}</p> : null}

        {rows.length > 0 ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lifecycle</th>
                  <th>slug</th>
                  <th>stage</th>
                  <th>status</th>
                  <th>updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={contentOsBoardHref(row.id)} className="nav-link">
                        #{row.id} · Content Board
                      </Link>
                    </td>
                    <td>{row.service_slug}</td>
                    <td>{row.stage}</td>
                    <td>{row.status}</td>
                    <td>{row.updated_at ? String(row.updated_at).slice(0, 10) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </CrmDeliveryPageShell>
  );
}

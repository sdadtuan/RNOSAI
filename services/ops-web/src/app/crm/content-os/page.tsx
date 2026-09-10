'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { staffMe, staffRefresh } from '@/lib/api';
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
import { CmktECommandCenter } from '@/components/content-os/cmkte/CmktECommandCenter';
import { fetchCommandCenter, type PortfolioCommandCenter } from '@/lib/crm/cmkte-api';

export default function CrmContentOsHubPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [center, setCenter] = useState<PortfolioCommandCenter | null>(null);
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
        setCenter(await fetchCommandCenter(access));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không tải được Command Center');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, router]);

  if (!user) {
    return null;
  }

  if (!isContentMarketingFeEnabled()) {
    return <p className="cmkte-status">Module tắt</p>;
  }

  return (
    <div>
      {loading ? <p className="cmkte-status">Đang tải…</p> : null}
      {error ? <p className="cmkte-status cmkte-status--error">{error}</p> : null}
      {!loading && !error && center ? <CmktECommandCenter data={center} /> : null}
    </div>
  );
}

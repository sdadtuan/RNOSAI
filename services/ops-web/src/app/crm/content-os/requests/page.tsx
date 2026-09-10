'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { CmktERequests } from '@/components/content-os/cmkte/CmktERequests';
import {
  fetchLifecycleIdeas,
  fetchPortfolioRequests,
  type LifecycleIdeaRow,
  type PortfolioContentRequest,
} from '@/lib/crm/cmkte-api';

export default function CrmContentOsRequestsPage() {
  return (
    <Suspense fallback={<p className="cmkte-status">Đang tải…</p>}>
      <CrmContentOsRequestsContent />
    </Suspense>
  );
}

function CrmContentOsRequestsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lifecycleParam = Number(searchParams.get('lifecycle') ?? '');
  const lifecycleId = Number.isInteger(lifecycleParam) && lifecycleParam > 0 ? lifecycleParam : undefined;
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [items, setItems] = useState<PortfolioContentRequest[] | null>(null);
  const [ideas, setIdeas] = useState<LifecycleIdeaRow[]>([]);
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
        const list = await fetchPortfolioRequests(access);
        setItems(list.items);
        if (lifecycleId) {
          setIdeas(await fetchLifecycleIdeas(access, lifecycleId));
        } else {
          setIdeas([]);
        }
      } catch (err) {
        setItems([]);
        setIdeas([]);
        setError(err instanceof Error ? err.message : 'Không tải được Content Requests');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, lifecycleId, router]);

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
      {!loading && items ? <CmktERequests items={items} ideas={ideas} lifecycleId={lifecycleId} /> : null}
    </div>
  );
}

'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { clearSession } from '@/lib/auth';
import { isContentMarketingFeEnabled } from '@/lib/content-marketing-flags';
import { fetchContentOsContext, type ContentOsContext } from '@/lib/content-os-api';
import { CmktESettings } from '@/components/content-os/cmkte/CmktESettings';
import { parseLifecycleQuery, useCmktEPageAuth } from '@/lib/crm/use-cmkte-page';

export default function CrmContentOsSettingsPage() {
  return (
    <Suspense fallback={<p className="cmkte-status">Đang tải…</p>}>
      <CrmContentOsSettingsContent />
    </Suspense>
  );
}

function CrmContentOsSettingsContent() {
  const searchParams = useSearchParams();
  const lifecycleId = parseLifecycleQuery(searchParams.get('lifecycle'));
  const { user, error, setError, ensureAuth, router } = useCmktEPageAuth();
  const [context, setContext] = useState<ContentOsContext | null>(null);
  const [loading, setLoading] = useState(false);

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
      if (!lifecycleId) {
        setContext(null);
        return;
      }
      setLoading(true);
      setError('');
      try {
        setContext(await fetchContentOsContext(access, lifecycleId));
      } catch (err) {
        setContext(null);
        setError(err instanceof Error ? err.message : 'Không tải được Governance Settings');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, lifecycleId, router, setError]);

  if (!user) return null;
  if (!isContentMarketingFeEnabled()) return <p className="cmkte-status">Module tắt</p>;

  return (
    <div>
      {loading ? <p className="cmkte-status">Đang tải…</p> : null}
      {error ? <p className="cmkte-status cmkte-status--error">{error}</p> : null}
      {!loading ? <CmktESettings context={context} /> : null}
    </div>
  );
}

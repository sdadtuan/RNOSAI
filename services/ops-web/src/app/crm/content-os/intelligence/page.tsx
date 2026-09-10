'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { clearSession } from '@/lib/auth';
import { isContentMarketingFeEnabled } from '@/lib/content-marketing-flags';
import { fetchContentOsIntelligenceSummary, type ContentOsIntelligence } from '@/lib/content-os-api';
import { CmktEIntelligence } from '@/components/content-os/cmkte/CmktEIntelligence';
import { parseLifecycleQuery, useCmktEPageAuth } from '@/lib/crm/use-cmkte-page';

export default function CrmContentOsIntelligencePage() {
  return (
    <Suspense fallback={<p className="cmkte-status">Đang tải…</p>}>
      <CrmContentOsIntelligenceContent />
    </Suspense>
  );
}

function CrmContentOsIntelligenceContent() {
  const searchParams = useSearchParams();
  const lifecycleId = parseLifecycleQuery(searchParams.get('lifecycle'));
  const { user, error, setError, ensureAuth, router } = useCmktEPageAuth();
  const [summary, setSummary] = useState<ContentOsIntelligence | null>(null);
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
        setSummary(null);
        return;
      }
      setLoading(true);
      setError('');
      try {
        setSummary(await fetchContentOsIntelligenceSummary(access, lifecycleId));
      } catch (err) {
        setSummary(null);
        setError(err instanceof Error ? err.message : 'Không tải được Content Intelligence');
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
      {!loading ? <CmktEIntelligence summary={summary} scoped={Boolean(lifecycleId)} /> : null}
    </div>
  );
}

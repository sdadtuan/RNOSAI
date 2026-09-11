'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { canApproveContentOs, clearSession } from '@/lib/auth';
import { isContentMarketingFeEnabled } from '@/lib/content-marketing-flags';
import { fetchContentOsIntelligenceSummary, type ContentOsIntelligence } from '@/lib/content-os-api';
import { CmktEIntelligence } from '@/components/content-os/cmkte/CmktEIntelligence';
import {
  approvePortfolioInsight,
  fetchPortfolioInsights,
  type PortfolioInsight,
} from '@/lib/crm/cmkte-api';
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
  const [insights, setInsights] = useState<PortfolioInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const canApprove = canApproveContentOs(user);

  const loadInsights = useCallback(
    async (access: string) => {
      const list = await fetchPortfolioInsights(access, lifecycleId);
      setInsights(list.items);
    },
    [lifecycleId],
  );

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
        setInsights([]);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const [intel, list] = await Promise.all([
          fetchContentOsIntelligenceSummary(access, lifecycleId),
          fetchPortfolioInsights(access, lifecycleId),
        ]);
        setSummary(intel);
        setInsights(list.items);
      } catch (err) {
        setSummary(null);
        setInsights([]);
        setError(err instanceof Error ? err.message : 'Không tải được Content Intelligence');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, lifecycleId, router, setError]);

  async function onApprove(insightId: number) {
    const access = await ensureAuth().catch(() => null);
    if (!access) return;
    setApproving(true);
    setError('');
    try {
      await approvePortfolioInsight(access, insightId);
      await loadInsights(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không duyệt được insight');
    } finally {
      setApproving(false);
    }
  }

  if (!user) return null;
  if (!isContentMarketingFeEnabled()) return <p className="cmkte-status">Module tắt</p>;

  return (
    <div>
      {loading ? <p className="cmkte-status">Đang tải…</p> : null}
      {error ? <p className="cmkte-status cmkte-status--error">{error}</p> : null}
      {!loading ? (
        <CmktEIntelligence
          summary={summary}
          scoped={Boolean(lifecycleId)}
          insights={insights}
          canApprove={canApprove}
          onApprove={onApprove}
          approving={approving}
          loadError={Boolean(error)}
        />
      ) : null}
    </div>
  );
}

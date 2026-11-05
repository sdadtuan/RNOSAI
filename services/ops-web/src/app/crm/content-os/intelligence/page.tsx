'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { canApproveContentOs, clearSession } from '@/lib/auth';
import { isContentMarketingFeEnabled } from '@/lib/content-marketing-flags';
import { fetchContentOsIntelligenceSummary, type ContentOsIntelligence } from '@/lib/content-os-api';
import { CmktEIntelligence } from '@/components/content-os/cmkte/CmktEIntelligence';
import {
  approvePortfolioGlossary,
  approvePortfolioInsight,
  createPortfolioGlossary,
  fetchPortfolioGlossary,
  fetchPortfolioInsights,
  type PortfolioGlossary,
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
  const [glossary, setGlossary] = useState<PortfolioGlossary[]>([]);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const canApprove = canApproveContentOs(user);

  const loadInsights = useCallback(
    async (access: string) => {
      const [list, terms] = await Promise.all([
        fetchPortfolioInsights(access, lifecycleId),
        fetchPortfolioGlossary(access, lifecycleId),
      ]);
      setInsights(list.items);
      setGlossary(terms.items);
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
        setGlossary([]);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const [intel, list, terms] = await Promise.all([
          fetchContentOsIntelligenceSummary(access, lifecycleId),
          fetchPortfolioInsights(access, lifecycleId),
          fetchPortfolioGlossary(access, lifecycleId),
        ]);
        setSummary(intel);
        setInsights(list.items);
        setGlossary(terms.items);
      } catch (err) {
        setSummary(null);
        setInsights([]);
        setGlossary([]);
        setError(err instanceof Error ? err.message : 'Không tải được Content Intelligence');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, lifecycleId, router, setError]);

  async function onCreateGlossary(body: {
    term: string;
    locale: string;
    brand_id: string;
    preferred?: string;
  }) {
    const access = await ensureAuth().catch(() => null);
    if (!access || !lifecycleId) return;
    setApproving(true);
    setError('');
    try {
      await createPortfolioGlossary(access, { ...body, lifecycle_id: lifecycleId });
      await loadInsights(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tạo được glossary Draft');
    } finally {
      setApproving(false);
    }
  }

  async function onApproveGlossary(glossaryId: number) {
    const access = await ensureAuth().catch(() => null);
    if (!access) return;
    setApproving(true);
    setError('');
    try {
      await approvePortfolioGlossary(access, glossaryId);
      await loadInsights(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không duyệt được glossary');
    } finally {
      setApproving(false);
    }
  }

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
          glossary={glossary}
          canApprove={canApprove}
          onApprove={onApprove}
          onApproveGlossary={onApproveGlossary}
          onCreateGlossary={onCreateGlossary}
          approving={approving}
          loadError={Boolean(error)}
        />
      ) : null}
    </div>
  );
}

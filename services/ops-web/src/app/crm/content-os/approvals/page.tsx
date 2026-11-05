'use client';

import { useEffect, useState } from 'react';
import { clearSession } from '@/lib/auth';
import { isContentMarketingFeEnabled } from '@/lib/content-marketing-flags';
import { CmktEApprovals } from '@/components/content-os/cmkte/CmktEApprovals';
import { fetchPortfolioApprovals, type PortfolioApprovalItem } from '@/lib/crm/cmkte-api';
import { useCmktEPageAuth } from '@/lib/crm/use-cmkte-page';

export default function CrmContentOsApprovalsPage() {
  const { user, error, setError, ensureAuth, router } = useCmktEPageAuth();
  const [items, setItems] = useState<PortfolioApprovalItem[] | null>(null);
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
      setLoading(true);
      setError('');
      try {
        const list = await fetchPortfolioApprovals(access);
        setItems(list.items);
      } catch (err) {
        setItems([]);
        setError(err instanceof Error ? err.message : 'Không tải được Approval Center');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, router, setError]);

  if (!user) return null;
  if (!isContentMarketingFeEnabled()) return <p className="cmkte-status">Module tắt</p>;

  return (
    <div>
      {loading ? <p className="cmkte-status">Đang tải…</p> : null}
      {error ? <p className="cmkte-status cmkte-status--error">{error}</p> : null}
      {!loading && items ? <CmktEApprovals items={items} /> : null}
    </div>
  );
}

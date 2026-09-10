'use client';

import { useEffect, useState } from 'react';
import { clearSession } from '@/lib/auth';
import { isContentMarketingFeEnabled } from '@/lib/content-marketing-flags';
import { CmktELibrary } from '@/components/content-os/cmkte/CmktELibrary';
import { fetchPortfolioItem } from '@/lib/crm/cmkte-api';
import { CMKTE_LAST_ITEM_KEY } from '@/lib/crm/cmkte-nav';
import { itemMediaUrls } from '@/lib/crm/cmkte-workspace';
import { useCmktEPageAuth } from '@/lib/crm/use-cmkte-page';

export default function CrmContentOsLibraryPage() {
  const { user, error, setError, ensureAuth, router } = useCmktEPageAuth();
  const [assetUrls, setAssetUrls] = useState<string[]>([]);
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
      const stored = Number(window.localStorage.getItem(CMKTE_LAST_ITEM_KEY));
      if (!(Number.isInteger(stored) && stored > 0)) {
        setAssetUrls([]);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const item = await fetchPortfolioItem(access, stored);
        setAssetUrls(itemMediaUrls(item));
      } catch {
        setAssetUrls([]);
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
      {!loading ? <CmktELibrary caps={user.caps} assetUrls={assetUrls} /> : null}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { clearSession } from '@/lib/auth';
import { isContentMarketingFeEnabled } from '@/lib/content-marketing-flags';
import { CmktELibrary } from '@/components/content-os/cmkte/CmktELibrary';
import { bindDamAsset, fetchDamAssets, fetchPortfolioItem } from '@/lib/crm/cmkte-api';
import { CMKTE_LAST_ITEM_KEY } from '@/lib/crm/cmkte-nav';
import { canBindDamUrl, inferDamAllowedHost, type DamUrlMetadata } from '@/lib/crm/cmkte-dam';
import { itemMediaUrls } from '@/lib/crm/cmkte-workspace';
import { useCmktEPageAuth } from '@/lib/crm/use-cmkte-page';

export default function CrmContentOsLibraryPage() {
  const { user, error, setError, ensureAuth, router } = useCmktEPageAuth();
  const [assetUrls, setAssetUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [damItems, setDamItems] = useState<DamUrlMetadata[]>([]);
  const [damError, setDamError] = useState('');
  const [damLoading, setDamLoading] = useState(false);
  const [damLoaded, setDamLoaded] = useState(false);
  const [itemId, setItemId] = useState<number | null>(null);

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
      setAccessToken(access);
      const stored = Number(window.localStorage.getItem(CMKTE_LAST_ITEM_KEY));
      if (!(Number.isInteger(stored) && stored > 0)) {
        setAssetUrls([]);
        setItemId(null);
        return;
      }
      setItemId(stored);
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
      {!loading ? (
        <CmktELibrary
          caps={user.caps}
          assetUrls={assetUrls}
          damItems={damItems}
          damError={damError}
          damLoading={damLoading}
          damLoaded={damLoaded}
          onPickFromDam={
            accessToken
              ? (collection) => {
                  void (async () => {
                    setDamLoading(true);
                    const result = await fetchDamAssets(accessToken, collection);
                    setDamItems(result.items);
                    setDamError(result.error ?? '');
                    setDamLoaded(true);
                    setDamLoading(false);
                  })();
                }
              : undefined
          }
          onBindDam={
            accessToken && itemId
              ? (asset) => {
                  const host = inferDamAllowedHost(damItems);
                  if (!canBindDamUrl(asset.url, host)) return;
                  void (async () => {
                    try {
                      await bindDamAsset(accessToken, itemId, {
                        dam_id: asset.id,
                        url: asset.url,
                        rights: asset.rights,
                      });
                    } catch (err) {
                      setDamError(err instanceof Error ? err.message : 'dam_unavailable');
                    }
                  })();
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}

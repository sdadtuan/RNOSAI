'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { clearSession } from '@/lib/auth';
import { isContentMarketingFeEnabled } from '@/lib/content-marketing-flags';
import { fetchContentOsContext, type ContentOsContext } from '@/lib/content-os-api';
import { CmktESettings } from '@/components/content-os/cmkte/CmktESettings';
import {
  fetchChannelAccounts,
  fetchPortfolioAuditExport,
  fetchPortfolioSettings,
  patchPortfolioSettings,
  postConnectorDisconnect,
  type ChannelAccountPublic,
} from '@/lib/crm/cmkte-api';
import { DEFAULT_DIRECT_SOCIAL_PUBLISH, DEFAULT_SSO_ENFORCED } from '@/lib/crm/cmkte-settings';
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
  const [token, setToken] = useState('');
  const [directSocialPublish, setDirectSocialPublish] = useState(DEFAULT_DIRECT_SOCIAL_PUBLISH);
  const [ssoEnforced, setSsoEnforced] = useState(DEFAULT_SSO_ENFORCED);
  const [accounts, setAccounts] = useState<ChannelAccountPublic[]>([]);
  const [settingsReady, setSettingsReady] = useState(false);
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
      setToken(access);
      setLoading(true);
      setSettingsReady(false);
      setError('');
      try {
        const settings = await fetchPortfolioSettings(access);
        setDirectSocialPublish(settings.direct_social_publish);
        setSsoEnforced(settings.sso_enforced);
        try {
          const listed = await fetchChannelAccounts(access);
          setAccounts(listed.items);
        } catch {
          setAccounts([]);
        }
        setSettingsReady(true);
        if (!lifecycleId) {
          setContext(null);
          return;
        }
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
      {!loading && settingsReady ? (
        <CmktESettings
          context={context}
          directSocialPublish={directSocialPublish}
          ssoEnforced={ssoEnforced}
          accounts={accounts}
          onSavePolicy={
            token
              ? async (next) => {
                  const saved = await patchPortfolioSettings(token, { direct_social_publish: next });
                  setDirectSocialPublish(saved.direct_social_publish);
                  setSsoEnforced(saved.sso_enforced);
                }
              : undefined
          }
          onExportAudit={token ? () => fetchPortfolioAuditExport(token) : undefined}
          onDisconnect={
            token
              ? async (id) => {
                  if (!(typeof id === 'number' && id > 0)) return;
                  await postConnectorDisconnect(token, id);
                  const listed = await fetchChannelAccounts(token);
                  setAccounts(listed.items);
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}

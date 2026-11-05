'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { CmktEWorkspace } from '@/components/content-os/cmkte/CmktEWorkspace';
import { getStoredUser, hasCap } from '@/lib/auth';
import {
  fetchChannelAccounts,
  fetchPortfolioSettings,
  postPublicationExecute,
  type ChannelAccountPublic,
} from '@/lib/crm/cmkte-api';
import { parseCmktETab } from '@/lib/crm/cmkte-tabs';
import { canShowDangLenPage, facebookPageHealth } from '@/lib/crm/cmkte-win-publish';
import { useCmktEPageAuth } from '@/lib/crm/use-cmkte-page';

export default function CrmContentOsWorkspacePage() {
  return (
    <Suspense fallback={<p className="cmkte-status">Đang tải…</p>}>
      <CrmContentOsWorkspaceContent />
    </Suspense>
  );
}

function CrmContentOsWorkspaceContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const rawId = Number(params?.itemId ?? 0);
  const itemId = Number.isInteger(rawId) && rawId > 0 ? rawId : 0;
  const hint = Number(searchParams.get('lifecycle') ?? '');
  const lifecycleHint = Number.isInteger(hint) && hint > 0 ? hint : undefined;
  const initialTab = parseCmktETab(searchParams.get('tab'));
  const { user, ensureAuth } = useCmktEPageAuth();
  const [token, setToken] = useState('');
  const [showDangLenPage, setShowDangLenPage] = useState(false);
  const [executeForbidden, setExecuteForbidden] = useState(false);
  const [pageName, setPageName] = useState('');
  const [channelAccountId, setChannelAccountId] = useState<number | undefined>();

  useEffect(() => {
    void (async () => {
      let access: string | null = null;
      try {
        access = await ensureAuth();
      } catch {
        return;
      }
      if (!access) return;
      setToken(access);
      try {
        const [settings, listed] = await Promise.all([
          fetchPortfolioSettings(access),
          fetchChannelAccounts(access),
        ]);
        applyPublishProps(user ?? getStoredUser(), settings.direct_social_publish, listed.items);
      } catch (err) {
        const status = err && typeof err === 'object' && 'status' in err ? Number(err.status) : 0;
        if (status === 403) {
          setExecuteForbidden(true);
          setShowDangLenPage(false);
          return;
        }
        setShowDangLenPage(false);
      }
    })();
  }, [ensureAuth, user]);

  function applyPublishProps(
    staff: typeof user,
    directSocialPublish: boolean,
    items: ChannelAccountPublic[],
  ) {
    const page = items.find((row) => row.channel === 'facebook_page') ?? items[0];
    const health = facebookPageHealth(items);
    const canPublish = Boolean(
      staff && hasCap(staff, 'crm_board', 'edit') && hasCap(staff, 'crm_content', 'publish'),
    );
    setPageName(page?.display_name ?? '');
    setChannelAccountId(page?.id);
    setExecuteForbidden(!canPublish);
    setShowDangLenPage(canShowDangLenPage({ directSocialPublish, health, canPublish }));
  }

  return (
    <CmktEWorkspace
      itemId={itemId}
      lifecycleHint={lifecycleHint}
      initialTab={initialTab}
      showDangLenPage={showDangLenPage}
      executeForbidden={executeForbidden}
      pageName={pageName}
      channelAccountId={channelAccountId}
      onExecute={token ? (body) => postPublicationExecute(token, body) : undefined}
    />
  );
}

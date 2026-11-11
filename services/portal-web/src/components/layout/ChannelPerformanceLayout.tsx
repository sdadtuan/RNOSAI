'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { PerformanceChannel } from '@/lib/api';
import { fetchPortalCrmPages, type PortalCrmPage } from '@/lib/api';
import { portalChannelConfig } from '@/lib/portal/channels';
import { PortalCrmAdsLeadReport } from '@/components/dashboard/PortalCrmAdsLeadReport';
import { PerformancePanel } from '@/components/PerformancePanel';
import { ChannelSwitcher } from './ChannelSwitcher';
import { PageToolbar } from './PageToolbar';
import { usePortalAdsChannelIds } from '@/lib/portal/ads-channels';

type ChannelPerformanceLayoutProps = {
  channel: PerformanceChannel;
  token: string;
  canSync?: boolean;
};

export function ChannelPerformanceLayout({ channel, token, canSync = false }: ChannelPerformanceLayoutProps) {
  const config = portalChannelConfig(channel);
  const ids = usePortalAdsChannelIds();
  const [adAccounts, setAdAccounts] = useState<PortalCrmPage[]>([]);
  const [adAccountsLoaded, setAdAccountsLoaded] = useState(false);
  const [accountId, setAccountId] = useState('');

  useEffect(() => {
    if (channel !== 'meta') return;
    let cancelled = false;
    setAdAccountsLoaded(false);
    void fetchPortalCrmPages(token)
      .then((res) => {
        if (cancelled) return;
        const active = (res.pages ?? []).filter((p) => p.active && p.channel === 'ad_account');
        setAdAccounts(active);
        setAccountId(active[0]?.page_id ?? '');
      })
      .catch(() => {
        if (!cancelled) {
          setAdAccounts([]);
          setAccountId('');
        }
      })
      .finally(() => {
        if (!cancelled) setAdAccountsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [channel, token]);

  if (ids != null && !ids.includes(channel)) {
    return <p>Kênh này chưa được thêm ở Kênh ads của CRM PTT.</p>;
  }

  const performanceAccountId =
    channel === 'meta' && accountId && accountId !== 'all' ? accountId : undefined;

  return (
    <div className={`channel-performance channel-performance--${channel}`}>
      <ChannelSwitcher active={channel} />
      <PageToolbar
        title={config.title}
        subtitle={config.subtitle}
        actions={
          <Link href="/dashboard" className="btn btn-secondary btn-sm">
            ← Tổng quan
          </Link>
        }
      />
      <div className="page-card stack-gap">
        {channel === 'meta' ? (
          <PortalCrmAdsLeadReport
            token={token}
            embedded
            adAccounts={adAccounts}
            adAccountsLoaded={adAccountsLoaded}
            accountId={accountId}
            onAccountIdChange={setAccountId}
            canSync={canSync}
          />
        ) : null}
        <PerformancePanel
          token={token}
          channel={channel}
          title="Bảng hiệu suất"
          subtitle={config.label}
          hideChannelColumn
          embedded
          accountId={performanceAccountId}
        />
      </div>
    </div>
  );
}

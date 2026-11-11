'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChannelQuickLinks } from '@/components/dashboard/ChannelQuickLinks';
import { DashboardKpiStrip } from '@/components/dashboard/DashboardKpiStrip';
import { PendingApprovalsWidget } from '@/components/PendingApprovalsWidget';
import { PortalAiReportSummary } from '@/components/PortalAiReportSummary';
import { MktAiPlanSummaryCard } from '@/components/MktAiPlanSummaryCard';
import { OpsDvSummaryCard } from '@/components/OpsDvSummaryCard';
import { ContentMarketingSummaryCard } from '@/components/ContentMarketingSummaryCard';
import { PortalCrmAdsLeadReport } from '@/components/dashboard/PortalCrmAdsLeadReport';
import { PerformancePanel } from '@/components/PerformancePanel';
import { HubPageLayout } from '@/components/layout';
import {
  fetchPortalNotificationSummary,
  fetchPortalDesk,
  fetchPortalSummary,
  portalSeoStatus,
  type PortalCrmSummary,
  type PortalDesk,
  type PortalNotificationSummaryResponse,
} from '@/lib/api';
import { countOnSaigonDay, saigonDayOffset } from '@/lib/portal/portal-leads-table.util';
import { usePortalEmailNav } from '@/hooks/usePortalEmailNav';
import { usePortalSeoNav } from '@/hooks/usePortalSeoNav';
import { usePortalAdsChannelIds } from '@/lib/portal/ads-channels';
import { PORTAL_CHANNEL_LIST } from '@/lib/portal/channels';

function versusYesterday(today: number, yesterday: number): string {
  const diff = today - yesterday;
  const sign = diff > 0 ? '+' : '';
  return `${sign}${diff} so với hôm qua (${yesterday})`;
}

export function DashboardContent({ token }: { token: string }) {
  const seoEnabled = usePortalSeoNav(token);
  const { pendingEmail } = usePortalEmailNav(token);
  const adsChannelIds = usePortalAdsChannelIds();
  const channelNames = PORTAL_CHANNEL_LIST.filter((channel) => adsChannelIds?.includes(channel.id)).map((channel) => channel.label);
  const [summary, setSummary] = useState<PortalNotificationSummaryResponse | null>(null);
  const [seoPending, setSeoPending] = useState(0);
  const [care, setCare] = useState<PortalCrmSummary | null>(null);
  const [desk, setDesk] = useState<PortalDesk | null>(null);

  useEffect(() => {
    void fetchPortalSummary(token).then(setCare).catch(() => setCare(null));
    void fetchPortalDesk(token, {}).then(setDesk).catch(() => setDesk(null));
  }, [token]);

  useEffect(() => {
    void fetchPortalNotificationSummary(token)
      .then(setSummary)
      .catch(() => setSummary(null));
  }, [token]);

  useEffect(() => {
    if (!seoEnabled) {
      setSeoPending(0);
      return;
    }
    void portalSeoStatus(token)
      .then((status) => setSeoPending(Number(status.pending_client_review ?? 0)))
      .catch(() => setSeoPending(0));
  }, [token, seoEnabled]);

  return (
    <HubPageLayout
      title="Tổng quan hiệu suất"
      subtitle={channelNames.length > 0 ? `${channelNames.join(' · ')} — CPL, chi tiêu và mục cần duyệt` : 'Chưa có kênh quảng cáo trên hồ sơ Client'}
      headerExtra={
        <>
          <DashboardKpiStrip token={token} />
          <ChannelQuickLinks />
        </>
      }
    >
      <section className="portal-hub-section">
        <div className="portal-crm__stats">
          <Link href="/crm/leads" style={{ color: 'inherit', textDecoration: 'none' }}>
            <article>
              <h2>Lead hôm nay</h2>
              <strong>{desk ? countOnSaigonDay(desk.leads, saigonDayOffset()) : (care?.leads_today ?? 0)}</strong>
              <p>{desk || care ? versusYesterday(desk ? countOnSaigonDay(desk.leads, saigonDayOffset()) : (care?.leads_today ?? 0), desk ? countOnSaigonDay(desk.leads, saigonDayOffset(new Date(), -1)) : (care?.leads_yesterday ?? 0)) : 'Đang tải…'}</p>
            </article>
          </Link>
          <Link href="/crm/messages" style={{ color: 'inherit', textDecoration: 'none' }}>
            <article>
              <h2>Tin nhắn hôm nay</h2>
              <strong>{desk ? countOnSaigonDay(desk.messages, saigonDayOffset()) : (care?.messages_today ?? 0)}</strong>
              <p>{desk || care ? versusYesterday(desk ? countOnSaigonDay(desk.messages, saigonDayOffset()) : (care?.messages_today ?? 0), desk ? countOnSaigonDay(desk.messages, saigonDayOffset(new Date(), -1)) : (care?.messages_yesterday ?? 0)) : 'Đang tải…'}</p>
            </article>
          </Link>
        </div>
      </section>

      <section className="portal-hub-section">
        <h2>Page đang nhận</h2>
        {care && (care.pages ?? []).length === 0 ? <p className="muted">Chưa gắn Page từ Kênh ads.</p> : null}
        <ul className="portal-crm__list">
          {(care?.pages ?? []).map((page) => (
            <li key={page.page_id}>
              <Link
                href={`/crm/messages?page_id=${encodeURIComponent(page.page_id)}`}
                style={{ color: 'inherit', textDecoration: 'none' }}
              >
                <div>
                  <strong>{page.page_name || 'Page'}</strong>
                  <span className="muted">Page ID {page.page_id}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="portal-hub-section">
        <PendingApprovalsWidget summary={summary} seoPending={seoPending} emailPending={pendingEmail} />
      </section>

      <section className="portal-hub-section">
        <PortalAiReportSummary token={token} />
      </section>

      <section className="portal-hub-section">
        <MktAiPlanSummaryCard token={token} />
      </section>

      <section className="portal-hub-section">
        <ContentMarketingSummaryCard token={token} />
      </section>

      <section className="portal-hub-section">
        <OpsDvSummaryCard token={token} />
      </section>

      <section className="portal-hub-section">
        <PortalCrmAdsLeadReport token={token} embedded />
      </section>

      <section className="portal-hub-section portal-hub-section--flush">
        <PerformancePanel token={token} title="Chi tiết theo ngày / chiến dịch" subtitle="Tất cả kênh" embedded />
      </section>
    </HubPageLayout>
  );
}

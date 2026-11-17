'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ChannelQuickLinks } from '@/components/dashboard/ChannelQuickLinks';
import { DashboardAdsSummary } from '@/components/dashboard/DashboardAdsSummary';
import { DashboardConversionCharts } from '@/components/dashboard/DashboardConversionCharts';
import { PendingApprovalsWidget } from '@/components/PendingApprovalsWidget';
import { PortalAiReportSummary } from '@/components/PortalAiReportSummary';
import { MktAiPlanSummaryCard } from '@/components/MktAiPlanSummaryCard';
import { OpsDvSummaryCard } from '@/components/OpsDvSummaryCard';
import { ContentMarketingSummaryCard } from '@/components/ContentMarketingSummaryCard';
import { HubPageLayout, SegmentedControl } from '@/components/layout';
import {
  fetchPortalNotificationSummary,
  fetchPortalDesk,
  fetchPortalSummary,
  portalSeoStatus,
  type PortalCrmSummary,
  type PortalDesk,
  type PortalNotificationSummaryResponse,
} from '@/lib/api';
import { usePortalEmailNav } from '@/hooks/usePortalEmailNav';
import { usePortalSeoNav } from '@/hooks/usePortalSeoNav';
import { useVisiblePoll } from '@/hooks/useVisiblePoll';
import { PORTAL_ADS_POLL_MS } from '@/lib/portal/ads-live-refresh';
import {
  DASHBOARD_RANGE_PRESETS,
  dashboardRange,
  countInRange,
  receivedDay,
  type DashboardRangePreset,
} from '@/lib/portal/dashboard-range';

export function DashboardContent({ token }: { token: string }) {
  const seoEnabled = usePortalSeoNav(token);
  const { pendingEmail } = usePortalEmailNav(token);
  const [preset, setPreset] = useState<DashboardRangePreset>('7');
  const range = useMemo(() => dashboardRange(preset), [preset]);
  const [summary, setSummary] = useState<PortalNotificationSummaryResponse | null>(null);
  const [seoPending, setSeoPending] = useState(0);
  const [care, setCare] = useState<PortalCrmSummary | null>(null);
  const [desk, setDesk] = useState<PortalDesk | null>(null);

  useEffect(() => {
    void fetchPortalSummary(token).then(setCare).catch(() => setCare(null));
    void fetchPortalDesk(token, {}).then(setDesk).catch(() => setDesk(null));
  }, [token]);

  useVisiblePoll(() => {
    // Read-only desk refresh so conversion ratios stay current. Never pass sync.
    void fetchPortalDesk(token, {})
      .then(setDesk)
      .catch(() => {
        /* keep previously rendered desk data */
      });
  }, PORTAL_ADS_POLL_MS, Boolean(token));

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

  const leadsReceived = desk ? countInRange(desk.leads, range.from, range.to, receivedDay) : null;
  const messagesReceived = desk ? countInRange(desk.messages, range.from, range.to, receivedDay) : null;

  return (
    <HubPageLayout
      title="Tổng quan"
      subtitle="Tỉ lệ chuyển đổi và tóm tắt quảng cáo"
      actions={
        <SegmentedControl
          className="dashboard-range-picker"
          label="Khoảng thời gian"
          value={preset}
          onChange={setPreset}
          options={DASHBOARD_RANGE_PRESETS.map((item) => ({
            id: item.id,
            label: item.pickerLabel,
          }))}
        />
      }
      headerExtra={<ChannelQuickLinks />}
    >
      <section className="portal-hub-section portal-hub-section--dashboard">
        <DashboardConversionCharts
          loading={desk == null}
          messages={desk?.messages ?? []}
          leads={desk?.leads ?? []}
          range={range}
        />
      </section>

      <section className="portal-hub-section portal-hub-section--dashboard">
        <DashboardAdsSummary
          token={token}
          range={range}
          leadsReceived={leadsReceived}
          messagesReceived={messagesReceived}
          leads={desk?.leads ?? []}
          messages={desk?.messages ?? []}
        />
      </section>

      <section className="portal-hub-section">
        <h2>Trang đang nhận</h2>
        {care && (care.pages ?? []).length === 0 ? <p className="muted">Chưa gắn trang từ kênh quảng cáo.</p> : null}
        <ul className="portal-crm__list">
          {(care?.pages ?? []).map((page) => (
            <li key={page.page_id}>
              <Link
                href={`/crm/messages?page_id=${encodeURIComponent(page.page_id)}`}
                style={{ color: 'inherit', textDecoration: 'none' }}
              >
                <div className="portal-crm__page-line">
                  <strong>{page.page_name || 'Trang'}</strong>
                  {page.page_id ? (
                    <span className="muted portal-crm__page-id">Mã trang {page.page_id}</span>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="portal-hub-section">
        <PendingApprovalsWidget summary={summary} seoPending={seoPending} emailPending={pendingEmail} />
      </section>

      <section className="portal-hub-section"><PortalAiReportSummary token={token} /></section>
      <section className="portal-hub-section"><MktAiPlanSummaryCard token={token} /></section>
      <section className="portal-hub-section"><ContentMarketingSummaryCard token={token} /></section>
      <section className="portal-hub-section"><OpsDvSummaryCard token={token} /></section>
    </HubPageLayout>
  );
}

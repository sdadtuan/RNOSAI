'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ChannelQuickLinks } from '@/components/dashboard/ChannelQuickLinks';
import { DashboardKpiStrip } from '@/components/dashboard/DashboardKpiStrip';
import { PendingApprovalsWidget } from '@/components/PendingApprovalsWidget';
import { PortalAiReportSummary } from '@/components/PortalAiReportSummary';
import { MktAiPlanSummaryCard } from '@/components/MktAiPlanSummaryCard';
import { OpsDvSummaryCard } from '@/components/OpsDvSummaryCard';
import { ContentMarketingSummaryCard } from '@/components/ContentMarketingSummaryCard';
import { PortalCrmAdsLeadReport } from '@/components/dashboard/PortalCrmAdsLeadReport';
import { PerformancePanel } from '@/components/PerformancePanel';
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
import {
  DASHBOARD_RANGE_PRESETS,
  dashboardRange,
  countInRange,
  receivedDay,
  shiftYmd,
  type DashboardRangePreset,
  LEAD_RECEIVED_LABEL,
  LEAD_RECEIVED_TIP,
} from '@/lib/portal/dashboard-range';

function versusYesterday(todayCount: number, yesterdayCount: number): string {
  const diff = todayCount - yesterdayCount;
  const sign = diff > 0 ? '+' : '';
  return `${sign}${diff} so với hôm qua (${yesterdayCount})`;
}

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
  const yesterdayYmd = shiftYmd(range.to, -1);
  const leadsYesterday = desk
    ? countInRange(desk.leads, yesterdayYmd, yesterdayYmd, receivedDay)
    : (care?.leads_yesterday ?? 0);
  const messagesYesterday = desk
    ? countInRange(desk.messages, yesterdayYmd, yesterdayYmd, receivedDay)
    : (care?.messages_yesterday ?? 0);

  return (
    <HubPageLayout
      title="Tổng quan"
      subtitle="Hiệu quả quảng cáo, lead và việc cần duyệt"
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
      headerExtra={
        <>
          <DashboardKpiStrip token={token} range={range} />
          <ChannelQuickLinks />
        </>
      }
    >
      <section className="portal-hub-section">
        <div className="portal-crm__stats">
          <Link href="/crm/leads" style={{ color: 'inherit', textDecoration: 'none' }}>
            <article data-testid="dash-leads-received">
              <h2 title={LEAD_RECEIVED_TIP}>{LEAD_RECEIVED_LABEL}</h2>
              <strong>
                {leadsReceived != null ? leadsReceived : preset === 'today' ? (care?.leads_today ?? '—') : '—'}
              </strong>
              <p className="muted">
                {preset === 'today' && (desk || care)
                  ? versusYesterday(leadsReceived ?? (care?.leads_today ?? 0), leadsYesterday)
                  : range.label}
              </p>
            </article>
          </Link>
          <Link href="/crm/messages" style={{ color: 'inherit', textDecoration: 'none' }}>
            <article data-testid="dash-messages-received">
              <h2>Tin nhắn</h2>
              <strong>
                {messagesReceived != null
                  ? messagesReceived
                  : preset === 'today'
                    ? (care?.messages_today ?? '—')
                    : '—'}
              </strong>
              <p className="muted">
                {preset === 'today' && (desk || care)
                  ? versusYesterday(messagesReceived ?? (care?.messages_today ?? 0), messagesYesterday)
                  : range.label}
              </p>
            </article>
          </Link>
        </div>
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

      <section className="portal-hub-section">
        <PortalCrmAdsLeadReport
          token={token}
          embedded
          range={{ since: range.from, until: range.to }}
          rangeLabel={range.label}
          receivedLeads={desk?.leads}
        />
      </section>

      <section className="portal-hub-section portal-hub-section--flush">
        <PerformancePanel
          token={token}
          title="Chi tiết theo ngày / chiến dịch"
          subtitle="Tất cả kênh"
          embedded
          range={{ from: range.from, to: range.to }}
          rangeLabel={range.label}
        />
      </section>
    </HubPageLayout>
  );
}

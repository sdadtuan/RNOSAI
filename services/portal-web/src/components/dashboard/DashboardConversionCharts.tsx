import { fmtNumber, fmtPct } from '@/lib/format';
import { conversionRatio, type ConversionSourceRow } from '@/lib/portal/dashboard-conversion.util';
import type { DashboardRange } from '@/lib/portal/dashboard-range';
import { PortalDonutChart } from '@/components/dashboard/PortalDonutChart';

type DashboardConversionChartsProps = {
  loading: boolean;
  messages: ConversionSourceRow[];
  leads: ConversionSourceRow[];
  range: DashboardRange;
};

function ratioCenter(percent: number | null): string {
  return percent == null ? '—' : fmtPct(percent, 0);
}

export function DashboardConversionCharts({
  loading,
  messages,
  leads,
  range,
}: DashboardConversionChartsProps) {
  const messageRatio = conversionRatio(messages, range.from, range.to);
  const leadRatio = conversionRatio(leads, range.from, range.to);

  if (loading) {
    return (
      <section className="dashboard-conversion" data-testid="dashboard-conversion" aria-busy="true">
        <h2 className="portal-hub-section__title">Tỉ lệ chuyển đổi</h2>
        <div className="dashboard-conversion__grid">
          <div className="dashboard-conversion__card kpi-tile--skeleton">
            <p className="dashboard-conversion__heading">Tin nhắn → Khách hàng</p>
            <div className="portal-donut portal-donut--skeleton" />
          </div>
          <div className="dashboard-conversion__card kpi-tile--skeleton">
            <p className="dashboard-conversion__heading">Lead → Khách hàng</p>
            <div className="portal-donut portal-donut--skeleton" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="dashboard-conversion" data-testid="dashboard-conversion">
      <h2 className="portal-hub-section__title">Tỉ lệ chuyển đổi</h2>
      <p className="muted dashboard-conversion__hint">
        Số cuộc đã được chuyển thành khách hàng (nút «Chuyển thành khách hàng» hoặc chốt đơn) trên
        tổng số cuộc nhận được trong {range.label}.
      </p>
      <div className="dashboard-conversion__grid">
        <article className="dashboard-conversion__card" data-testid="dashboard-conversion-messages">
          <h3 className="dashboard-conversion__heading">Tin nhắn → Khách hàng</h3>
          <PortalDonutChart
            ariaLabel={`Tin nhắn thành khách hàng ${ratioCenter(messageRatio.percent)}`}
            center={ratioCenter(messageRatio.percent)}
            sublabel={
              messageRatio.total > 0
                ? `${fmtNumber(messageRatio.converted)} / ${fmtNumber(messageRatio.total)}`
                : 'Chưa có tin'
            }
            slices={[
              { id: 'converted', label: 'Đã thành khách', value: messageRatio.converted, color: '#17692f' },
              {
                id: 'open',
                label: 'Chưa chuyển',
                value: Math.max(0, messageRatio.total - messageRatio.converted),
                color: '#d5ddd7',
              },
            ]}
          />
          <p className="muted dashboard-conversion__meta">{range.label}</p>
        </article>
        <article className="dashboard-conversion__card" data-testid="dashboard-conversion-leads">
          <h3 className="dashboard-conversion__heading">Lead → Khách hàng</h3>
          <PortalDonutChart
            ariaLabel={`Lead thành khách hàng ${ratioCenter(leadRatio.percent)}`}
            center={ratioCenter(leadRatio.percent)}
            sublabel={
              leadRatio.total > 0
                ? `${fmtNumber(leadRatio.converted)} / ${fmtNumber(leadRatio.total)}`
                : 'Chưa có lead'
            }
            slices={[
              { id: 'converted', label: 'Đã thành khách', value: leadRatio.converted, color: '#17692f' },
              {
                id: 'open',
                label: 'Chưa chuyển',
                value: Math.max(0, leadRatio.total - leadRatio.converted),
                color: '#d5ddd7',
              },
            ]}
          />
          <p className="muted dashboard-conversion__meta">{range.label}</p>
        </article>
      </div>
    </section>
  );
}

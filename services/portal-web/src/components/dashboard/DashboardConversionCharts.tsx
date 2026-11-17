import { fmtNumber, fmtPct } from '@/lib/format';
import { conversionRatio, type ConversionRatio, type ConversionSourceRow } from '@/lib/portal/dashboard-conversion.util';
import type { DashboardRange } from '@/lib/portal/dashboard-range';
import { PortalDonutChart } from '@/components/dashboard/PortalDonutChart';

type DashboardConversionChartsProps = {
  loading: boolean;
  messages: ConversionSourceRow[];
  leads: ConversionSourceRow[];
  range: DashboardRange;
};

const CONVERTED_COLOR = '#17692f';
const OPEN_COLOR = '#d5ddd7';

function ratioCenter(percent: number | null): string {
  return percent == null ? '—' : fmtPct(percent, 0);
}

function ConversionCard({
  testId,
  heading,
  ariaPrefix,
  ratio,
  emptyLabel,
  rangeLabel,
}: {
  testId: string;
  heading: string;
  ariaPrefix: string;
  ratio: ConversionRatio;
  emptyLabel: string;
  rangeLabel: string;
}) {
  const open = Math.max(0, ratio.total - ratio.converted);
  const slices = [
    { id: 'converted', label: 'Đã thành khách', value: ratio.converted, color: CONVERTED_COLOR },
    { id: 'open', label: 'Chưa chuyển', value: open, color: OPEN_COLOR },
  ];
  const legend = slices.filter((slice) => slice.value > 0);

  return (
    <article className="dashboard-conversion__card" data-testid={testId}>
      <div className="dashboard-conversion__card-head">
        <h3 className="dashboard-conversion__heading">{heading}</h3>
        <p className="muted dashboard-conversion__meta">{rangeLabel}</p>
      </div>
      <div className="dashboard-conversion__body">
        <PortalDonutChart
          ariaLabel={`${ariaPrefix} ${ratioCenter(ratio.percent)}`}
          center={ratioCenter(ratio.percent)}
          sublabel={
            ratio.total > 0
              ? `${fmtNumber(ratio.converted)} / ${fmtNumber(ratio.total)}`
              : emptyLabel
          }
          slices={slices}
          size={124}
          thickness={15}
          showLegend={false}
        />
        {legend.length > 1 ? (
          <ul className="dashboard-conversion__legend">
            {legend.map((slice) => (
              <li key={slice.id}>
                <span className="dashboard-conversion__swatch" style={{ background: slice.color }} />
                <span className="dashboard-conversion__legend-label">{slice.label}</span>
                <strong>{fmtNumber(slice.value)}</strong>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
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
            <div className="dashboard-conversion__card-head">
              <p className="dashboard-conversion__heading">Tin nhắn → Khách hàng</p>
            </div>
            <div className="portal-donut portal-donut--skeleton" />
          </div>
          <div className="dashboard-conversion__card kpi-tile--skeleton">
            <div className="dashboard-conversion__card-head">
              <p className="dashboard-conversion__heading">Lead → Khách hàng</p>
            </div>
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
        <ConversionCard
          testId="dashboard-conversion-messages"
          heading="Tin nhắn → Khách hàng"
          ariaPrefix="Tin nhắn thành khách hàng"
          ratio={messageRatio}
          emptyLabel="Chưa có tin"
          rangeLabel={range.label}
        />
        <ConversionCard
          testId="dashboard-conversion-leads"
          heading="Lead → Khách hàng"
          ariaPrefix="Lead thành khách hàng"
          ratio={leadRatio}
          emptyLabel="Chưa có lead"
          rangeLabel={range.label}
        />
      </div>
    </section>
  );
}

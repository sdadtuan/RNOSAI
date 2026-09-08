'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React, { useMemo } from 'react';
import { dash } from '@/lib/crm/qt-format';

export const QT_REPORT_TABS = [
  { id: 'rpt-01', label: 'Điều hành' },
  { id: 'rpt-02', label: 'Funnel' },
  { id: 'rpt-03', label: 'Margin' },
  { id: 'rpt-04', label: 'Lý do thua' },
  { id: 'rpt-05', label: 'Tương tác' },
] as const;

export type QtReportTabId = (typeof QT_REPORT_TABS)[number]['id'];

export const QT_RPT01_TILES = [
  { key: 'sent_count', label: 'Quote đã gửi', hint: 'số + giá trị payable' },
  { key: 'sent_to_viewed', label: 'Được xem', hint: 'sent-to-viewed' },
  { key: 'sent_to_accepted', label: 'Đã xác nhận', hint: 'sent-to-accepted' },
  { key: 'avg_approval_hours', label: 'Avg. approval', hint: 'giờ trung bình' },
] as const;

const FUNNEL_STEPS = ['Draft', 'Sent', 'Viewed', 'Accepted'] as const;

export function asReportTab(value: string | null | undefined): QtReportTabId {
  return QT_REPORT_TABS.some((tab) => tab.id === value)
    ? (value as QtReportTabId)
    : 'rpt-01';
}

function EmptyTable({ columns }: { columns: string[] }) {
  return (
    <div className="qt-table-wrap">
      <table className="qt-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="qt-empty" colSpan={columns.length}>
              {dash(null)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function QtReportsChrome({
  tab = 'rpt-01',
  onTab,
}: {
  tab?: QtReportTabId;
  onTab?: (id: QtReportTabId) => void;
}) {
  const active = asReportTab(tab);
  return (
    <div className="qt-reports">
      <header className="qt-head">
        <div>
          <p className="qt-crumb">Kinh doanh / Báo giá / Báo cáo</p>
          <h1>Báo cáo</h1>
          <p className="qt-muted">RPT-01…05 · kỳ + scope · doanh thu agency không cộng media</p>
        </div>
      </header>
      <div className="qt-tabs">
        {QT_REPORT_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`qt-tab${item.id === active ? ' qt-tab--on' : ''}`}
            onClick={onTab ? () => onTab(item.id) : undefined}
          >
            {item.label}
          </button>
        ))}
      </div>

      {active === 'rpt-01' ? (
        <section>
          <h2>Báo cáo điều hành</h2>
          <div className="qt-tiles">
            {QT_RPT01_TILES.map((tile) => (
              <article className="qt-tile" key={tile.key}>
                <span>{tile.label}</span>
                <strong>{dash(null)}</strong>
                <em>{tile.hint}</em>
              </article>
            ))}
          </div>
          <p className="qt-muted">
            Win rate dashboard = accepted/(accepted+rejected). Báo cáo này ghi sent-to-accepted riêng.
          </p>
        </section>
      ) : null}

      {active === 'rpt-02' ? (
        <section>
          <h2>Funnel chuyển đổi</h2>
          {FUNNEL_STEPS.map((step) => (
            <div className="qt-side-row" key={step}>
              <span>{step}</span>
              <b>{dash(null)}</b>
            </div>
          ))}
        </section>
      ) : null}

      {active === 'rpt-03' ? (
        <section>
          <h2>Margin theo nhóm dịch vụ</h2>
          <p className="qt-muted">RPT-03 · NSR fee-only · không cộng media</p>
          <EmptyTable columns={['Nhóm', 'NSR', 'Direct cost', 'GM']} />
        </section>
      ) : null}

      {active === 'rpt-04' ? (
        <section>
          <h2>Lý do thua quote</h2>
          <div className="qt-card">
            <div className="qt-side-row">
              <span>Lost reason</span>
              <b>{dash(null)}</b>
            </div>
          </div>
        </section>
      ) : null}

      {active === 'rpt-05' ? (
        <section>
          <h2>Tương tác proposal</h2>
          <EmptyTable columns={['Quote', 'First view', 'Last', 'Section sâu', 'Comment']} />
        </section>
      ) : null}
    </div>
  );
}

export function QtReports() {
  const router = useRouter();
  const pathname = usePathname() ?? '/crm/proposals/reports';
  const searchParams = useSearchParams();
  const tab = useMemo(() => asReportTab(searchParams.get('tab')), [searchParams]);

  function changeTab(next: QtReportTabId) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'rpt-01') params.delete('tab');
    else params.set('tab', next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  return <QtReportsChrome tab={tab} onTab={changeTab} />;
}

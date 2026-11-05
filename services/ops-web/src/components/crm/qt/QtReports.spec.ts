import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { dash } from '@/lib/crm/qt-format';
import { asReportTab, QT_REPORT_TABS, QtReportsChrome } from './QtReports';

const FORBIDDEN = ['sẽ có ở W2', 'mở ở Wave', 'NOVA', 'Nhảy màn', '265.647.600', '22,4', '8,46'];

describe('QtReportsChrome', () => {
  it('renders five RPT tabs with dashed values', () => {
    expect(QT_REPORT_TABS.map((tab) => tab.id)).toEqual([
      'rpt-01',
      'rpt-02',
      'rpt-03',
      'rpt-04',
      'rpt-05',
    ]);

    const html = renderToStaticMarkup(createElement(QtReportsChrome, { tab: 'rpt-01' }));

    expect(html).toContain('Điều hành');
    expect(html).toContain('Funnel');
    expect(html).toContain('Margin');
    expect(html).toContain('Lý do thua');
    expect(html).toContain('Tương tác');
    expect(html).toContain('sent-to-accepted');
    expect(html).toContain(dash(null));
    expect(html.match(/—/g)?.length).toBeGreaterThanOrEqual(4);
    expect(html).not.toContain('<main');
    for (const banned of FORBIDDEN) {
      expect(html).not.toContain(banned);
    }
  });

  it('accepts SRS slugs and rpt-0N query values', () => {
    expect(asReportTab('executive')).toBe('rpt-01');
    expect(asReportTab('funnel')).toBe('rpt-02');
    expect(asReportTab('margin')).toBe('rpt-03');
    expect(asReportTab('loss')).toBe('rpt-04');
    expect(asReportTab('engagement')).toBe('rpt-05');
    expect(asReportTab('rpt-03')).toBe('rpt-03');
  });
});

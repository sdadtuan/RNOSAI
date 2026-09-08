import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { dash } from '@/lib/crm/qt-format';
import { QT_REPORT_TABS, QtReportsChrome } from './QtReports';

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
});

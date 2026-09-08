import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { QtAlertBar, QtKpiTiles, type QtOverviewKpis } from './QtOverview';

const NULL_KPIS: QtOverviewKpis = {
  open_quote_value: null,
  pending_approval_count: null,
  quote_win_rate: null,
  forecast_gross_margin: null,
};

describe('QtKpiTiles', () => {
  it('renders four em dashes for null KPIs and never shows mockup 8,46', () => {
    const html = renderToStaticMarkup(
      createElement(QtKpiTiles, {
        kpis: NULL_KPIS,
        winRateFormula: 'accepted/(accepted+rejected)',
      }),
    );
    const values = [...html.matchAll(/<strong>([^<]*)<\/strong>/g)].map((match) => match[1]);

    expect(values).toEqual(['—', '—', '—', '—']);
    expect(html).not.toContain('8,46');
    expect(html).not.toContain('265.647.600');
    expect(html).not.toContain('22,4');
    expect(html).toContain('accepted/(accepted+rejected)');
    expect(html).toContain('/crm/proposals/list?open=1');
    expect(html).toContain('/crm/proposals/approvals');
    expect(html).toContain('Giá trị quote đang mở');
    expect(html).toContain('Chờ phê duyệt');
    expect(html).toContain('Tỷ lệ chốt');
    expect(html).toContain('GM dự kiến');
  });
});

describe('QtAlertBar', () => {
  it('renders nothing when there are no actions', () => {
    const html = renderToStaticMarkup(createElement(QtAlertBar, { actions: [] }));
    expect(html).toBe('');
  });
});

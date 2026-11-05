import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  QtAlertBar,
  QtKpiTiles,
  detectPeriod,
  periodRange,
  withDefaultOverviewPeriod,
  type QtOverviewKpis,
} from './QtOverview';

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

describe('detectPeriod / default range', () => {
  const now = new Date('2026-09-07T20:00:00.000Z');

  it('uses Asia/Ho_Chi_Minh for the current-month range', () => {
    expect(periodRange('month', now)).toEqual({ from: '2026-09-01', to: '2026-09-08' });
    expect(periodRange('7d', now)).toEqual({ from: '2026-09-02', to: '2026-09-08' });
    expect(periodRange('30d', now)).toEqual({ from: '2026-08-10', to: '2026-09-08' });
    expect(periodRange('quarter', now)).toEqual({ from: '2026-07-01', to: '2026-09-08' });
  });

  it('labels Tháng này only when from/to are that month', () => {
    expect(detectPeriod('', '', now)).not.toBe('month');
    expect(detectPeriod('2026-09-01', '2026-09-08', now)).toBe('month');
    expect(detectPeriod('2026-09-02', '2026-09-08', now)).toBe('7d');
    expect(detectPeriod('2026-08-10', '2026-09-08', now)).toBe('30d');
    expect(detectPeriod('2026-07-01', '2026-09-08', now)).toBe('quarter');
    expect(detectPeriod('2026-01-01', '2026-12-31', now)).toBe('');
  });

  it('labels Tháng này when period=month even if the month range equals 7d', () => {
    const day7 = new Date('2026-09-06T20:00:00.000Z');
    const range = periodRange('month', day7);
    expect(range).toEqual({ from: '2026-09-01', to: '2026-09-07' });
    expect(range).toEqual(periodRange('7d', day7));
    expect(detectPeriod(range.from, range.to, day7)).toBe('7d');
    expect(detectPeriod(range.from, range.to, day7, 'month')).toBe('month');
  });

  it('writes the current-month range when from/to are absent', () => {
    const next = withDefaultOverviewPeriod(new URLSearchParams('scope=team'), now);
    expect(next.get('from')).toBe('2026-09-01');
    expect(next.get('to')).toBe('2026-09-08');
    expect(next.get('period')).toBe('month');
    expect(next.get('scope')).toBe('team');

    const kept = withDefaultOverviewPeriod(
      new URLSearchParams('from=2026-01-01&to=2026-01-31'),
      now,
    );
    expect(kept.get('from')).toBe('2026-01-01');
    expect(kept.get('to')).toBe('2026-01-31');
    expect(kept.get('period')).toBeNull();
  });
});

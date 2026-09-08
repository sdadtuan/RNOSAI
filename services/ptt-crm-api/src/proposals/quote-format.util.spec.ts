import { emptyKpis } from './quote.types';
import { dash, kpiOrNull } from './quote-format.util';

it('empty book KPIs are null not zero', () => {
  const k = emptyKpis();
  expect(k.open_quote_value).toBeNull();
  expect(k.pending_approval_count).toBeNull();
  expect(k.quote_win_rate).toBeNull();
  expect(k.forecast_gross_margin).toBeNull();
  expect(Object.keys(k)).toHaveLength(4);
});

it('kpiOrNull treats missing as null', () => {
  expect(kpiOrNull(undefined)).toBeNull();
  expect(kpiOrNull(0)).toBe(0);
});

it('dash never fakes zero for missing money', () => {
  expect(dash(null)).toBeNull();
  expect(dash(undefined)).toBeNull();
  expect(dash(0)).toBe(0);
});

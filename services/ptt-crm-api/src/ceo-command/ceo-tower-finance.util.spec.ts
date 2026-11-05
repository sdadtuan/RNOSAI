import {
  buildFinanceStrip,
  buildS11Exception,
  isS11Fail,
} from './ceo-tower-finance.util';

describe('ceo-tower-finance.util', () => {
  const baseInput = {
    cash_close: 60_000_000,
    cash_safe_min_vnd: 50_000_000,
    ar_overdue: 20_000_000,
    ar_overdue_max_vnd: 30_000_000,
    revenue_received_30d: 15_000_000,
    top1_share_pct: 35,
    top1_share_max_pct: 40,
    gross_margin: 32,
    gross_margin_target_pct: 30,
  };

  it('isS11Fail when top1 > 40', () => {
    expect(isS11Fail(41)).toBe(true);
    expect(isS11Fail(40)).toBe(false);
    expect(isS11Fail(39)).toBe(false);
    expect(isS11Fail(45, 40)).toBe(true);
  });

  it('buildS11Exception is company rollup row on care', () => {
    const ex = buildS11Exception(55);
    expect(ex.entity_type).toBe('lead');
    expect(ex.entity_id).toBe(0);
    expect(ex.column_id).toBe('care');
    expect(ex.factory).toBe('A');
    expect(ex.sensor_ids).toEqual(['S11']);
    expect(ex.severity).toBe('red');
    expect(ex.title_vi).toBe('Top-1 khách > 40% DT');
    expect(ex.suggest_action).toBeNull();
    expect(ex.href).toBe('/crm/owner-weekly');
  });

  it('buildFinanceStrip maps cell statuses from Owner Weekly targets', () => {
    const strip = buildFinanceStrip(baseInput);
    expect(strip.map((c) => c.key)).toEqual(['cash', 'ar', 'dt30', 'top1', 'gm']);
    expect(strip[0]?.status).toBe('green');
    expect(strip[1]?.status).toBe('green');
    expect(strip[2]?.status).toBe('neutral');
    expect(strip[3]?.status).toBe('green');
    expect(strip[4]?.status).toBe('green');
  });

  it('cash red when below safe min; ar red when above max; top1 red when above max', () => {
    const strip = buildFinanceStrip({
      ...baseInput,
      cash_close: 30_000_000,
      ar_overdue: 40_000_000,
      top1_share_pct: 50,
    });
    expect(strip.find((c) => c.key === 'cash')?.status).toBe('red');
    expect(strip.find((c) => c.key === 'ar')?.status).toBe('red');
    expect(strip.find((c) => c.key === 'top1')?.status).toBe('red');
  });

  it('dt30 amber when zero, no red path', () => {
    const strip = buildFinanceStrip({ ...baseInput, revenue_received_30d: 0 });
    expect(strip.find((c) => c.key === 'dt30')?.status).toBe('amber');
  });
});

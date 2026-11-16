import { describe, it, expect } from 'vitest';
import type { PerformanceListResponse, PerformanceRow } from '@/lib/api';
import {
  adsChannelBreakdown,
  adsChannelOf,
  adsSummarySpend,
  adsTotalsFromRows,
  conversionRatio,
  fmtCompactVnd,
  periodDeltaPct,
  previousEqualWindow,
  spendByChannel,
} from './dashboard-conversion.util';

const row = (
  partial: Partial<PerformanceRow> & { spend: number },
): PerformanceRow => ({
  external_campaign_id: partial.external_campaign_id ?? 'c1',
  external_campaign_name: partial.external_campaign_name ?? 'Camp',
  spend: partial.spend,
  currency: 'VND',
  impressions: partial.impressions ?? 0,
  clicks: partial.clicks ?? 0,
  leads_crm: partial.leads_crm ?? 0,
  leads_platform: partial.leads_platform ?? 0,
  cpl: null,
  target_cpl_vnd: null,
  cpl_delta_vnd: null,
  cpl_delta_pct: null,
  conversion_value: 0,
  roas: null,
  roas_stub: false,
  hub_mapped: true,
  synced_at: null,
  channel: partial.channel,
  performance_date: partial.performance_date ?? '2026-11-12',
});

describe('conversionRatio', () => {
  const rows = [
    { customer_id: 'c1', last_interaction_at: '2026-11-10T03:00:00+07:00' },
    { customer_id: null, last_interaction_at: '2026-11-11T10:00:00+07:00' },
    { customer_id: 'c2', last_interaction_at: '2026-11-12T22:00:00+07:00' },
    // outside range
    { customer_id: 'c3', last_interaction_at: '2026-11-05T08:00:00+07:00' },
    // no day — ignored
    { customer_id: 'c4', last_interaction_at: '' },
  ];

  it('is converted / total in the selected range, using receivedDay', () => {
    const result = conversionRatio(rows, '2026-11-10', '2026-11-12');
    expect(result).toEqual({ converted: 2, total: 3, percent: (2 / 3) * 100 });
  });

  it('returns null percent when the range is empty', () => {
    expect(conversionRatio(rows, '2026-11-01', '2026-11-02')).toEqual({
      converted: 0,
      total: 0,
      percent: null,
    });
  });

  it('treats a zero-conversion range as 0%', () => {
    const onlyOpen = [{ customer_id: null, last_interaction_at: '2026-11-11T10:00:00+07:00' }];
    expect(conversionRatio(onlyOpen, '2026-11-11', '2026-11-11')).toEqual({
      converted: 0,
      total: 1,
      percent: 0,
    });
  });

  it('falls back to created_at when last_interaction_at is missing', () => {
    const created = [{ customer_id: 'c1', created_at: '2026-11-12T01:00:00+07:00' }];
    expect(conversionRatio(created, '2026-11-12', '2026-11-12').total).toBe(1);
    expect(conversionRatio(created, '2026-11-12', '2026-11-12').converted).toBe(1);
  });
});

describe('ads totals and spend by channel', () => {
  const rows = [
    row({ channel: 'meta', spend: 100_000, clicks: 14, impressions: 610 }),
    row({ channel: 'meta', spend: 50_000, clicks: 2, impressions: 90 }),
    row({ channel: 'zalo', spend: 80_000, clicks: 5, impressions: 200 }),
    row({ channel: 'google', spend: 0, clicks: 0, impressions: 0 }),
  ];

  it('groups positive spend by channel, Meta first when largest', () => {
    const slices = spendByChannel(rows);
    expect(slices).toEqual([
      { id: 'meta', label: 'Meta', value: 150_000, color: '#17692f' },
      { id: 'zalo', label: 'Zalo Ads', value: 80_000, color: '#0d9488' },
    ]);
    expect(slices[0].color).not.toBe(slices[1].color);
  });

  it('computes CTR as clicks / impressions * 100', () => {
    const totals = adsTotalsFromRows(rows);
    expect(totals.clicks).toBe(21);
    expect(totals.impressions).toBe(900);
    expect(totals.ctr).toBeCloseTo((21 / 900) * 100, 8);
  });

  it('prefers the server summary spend so campaign-level de-duplication is kept', () => {
    const performance = {
      summary: { total_spend: 230_000 },
      rows,
    } as PerformanceListResponse;
    expect(adsSummarySpend(performance)).toBe(230_000);
    expect(adsSummarySpend(null)).toBeNull();
  });
});

describe('adsChannelBreakdown', () => {
  it('maps facebook/meta/zalo labels onto channel ids', () => {
    expect(adsChannelOf('facebook')).toBe('meta');
    expect(adsChannelOf('meta')).toBe('meta');
    expect(adsChannelOf(null, 'qa4-local-demo-camp-zalo-oa')).toBe('zalo');
    expect(adsChannelOf('facebook', null, ['zalo'])).toBe('zalo');
  });

  it('shows connected channels at zero spend so the split stays visible', () => {
    const rows = [
      row({ channel: 'meta', spend: 100_000, clicks: 10, impressions: 500 }),
    ];
    const leads = [
      { channel: 'facebook', last_interaction_at: '2026-11-12T10:00:00+07:00' },
      { labels: ['zalo'], last_interaction_at: '2026-11-12T11:00:00+07:00' },
    ];
    const out = adsChannelBreakdown({
      connectedIds: ['meta', 'zalo'],
      spendRows: rows,
      leads,
      messages: [],
      from: '2026-11-10',
      to: '2026-11-12',
    });
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ id: 'meta', spend: 100_000, percent: 100, leads: 1, color: '#17692f' });
    expect(out[1]).toMatchObject({ id: 'zalo', spend: 0, percent: 0, leads: 1, color: '#0d9488' });
    expect(out[0].color).not.toBe(out[1].color);
  });
});

describe('previousEqualWindow', () => {
  it('returns the immediately preceding equal-length window', () => {
    expect(previousEqualWindow('2026-11-07', '2026-11-13')).toEqual({ from: '2026-10-31', to: '2026-11-06' });
    expect(previousEqualWindow('2026-11-13', '2026-11-13')).toEqual({ from: '2026-11-12', to: '2026-11-12' });
    expect(previousEqualWindow('2026-11-01', '2026-11-13')).toEqual({ from: '2026-10-19', to: '2026-10-31' });
    expect(previousEqualWindow('2026-10-15', '2026-11-13')).toEqual({ from: '2026-09-15', to: '2026-10-14' });
  });

  it('returns null for an inverted range', () => {
    expect(previousEqualWindow('2026-11-13', '2026-11-07')).toBeNull();
    expect(previousEqualWindow('', '2026-11-13')).toBeNull();
  });
});

describe('periodDeltaPct', () => {
  it('returns the relative percent change', () => {
    expect(periodDeltaPct(110, 100)).toBeCloseTo(10, 8);
    expect(periodDeltaPct(80, 100)).toBeCloseTo(-20, 8);
    expect(periodDeltaPct(100, 100)).toBe(0);
  });

  it('hides the delta when there is no previous baseline', () => {
    expect(periodDeltaPct(100, 0)).toBeNull();
    expect(periodDeltaPct(100, null)).toBeNull();
    expect(periodDeltaPct(null, 100)).toBeNull();
  });
});

describe('fmtCompactVnd', () => {
  it('formats millions as tr and thousands as k, vi-VN decimals', () => {
    expect(fmtCompactVnd(16_825_000)).toBe('16,8tr');
    expect(fmtCompactVnd(5_476_000)).toBe('5,5tr');
    expect(fmtCompactVnd(956_000)).toBe('956k');
    expect(fmtCompactVnd(2_000_000)).toBe('2tr');
  });
});

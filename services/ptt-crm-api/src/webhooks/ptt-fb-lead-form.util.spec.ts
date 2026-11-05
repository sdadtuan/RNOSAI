import {
  PTT_LEAD_BUDGET_VALUES,
  PTT_LEAD_CHANNEL_VALUES,
  PTT_LEAD_FORM_KEYS,
  leadFormQualific,
  leadFormQualificRate,
} from './ptt-fb-lead-form.util';

describe('PTT_LEAD_FORM_KEYS', () => {
  it('locks Instant Form keys Ads Manager must use', () => {
    expect(PTT_LEAD_FORM_KEYS).toEqual({
      full_name: 'full_name',
      phone_number: 'phone_number',
      company_name: 'company_name',
      ad_budget_band: 'ad_budget_band',
      ad_channels: 'ad_channels',
    });
    expect(PTT_LEAD_BUDGET_VALUES).toEqual(['<20tr', '20-50', '50-100', '>100']);
    expect(PTT_LEAD_CHANNEL_VALUES).toEqual(['meta', 'tiktok', 'google', 'none']);
  });
});

describe('leadFormQualific', () => {
  it('qualifies when company + budget + channel are present', () => {
    expect(leadFormQualific({
      full_name: 'Lan',
      phone_number: '0900000000',
      company_name: 'PTT Demo',
      ad_budget_band: '20-50',
      ad_channels: 'meta',
    })).toEqual({
      has_company: true,
      has_budget: true,
      has_channel: true,
      qualified: true,
    });
  });

  it('accepts company alias and rejects short company or unknown bands', () => {
    expect(leadFormQualific({ company: 'AB', ad_budget_band: '20-50', ad_channels: 'tiktok' }).qualified).toBe(true);
    expect(leadFormQualific({ company_name: 'A', ad_budget_band: '20-50', ad_channels: 'meta' }).qualified).toBe(false);
    expect(leadFormQualific({ company_name: 'PTT', ad_budget_band: '20–50', ad_channels: 'meta' }).has_budget).toBe(false);
  });
});

describe('leadFormQualificRate', () => {
  it('returns 0 when there are no leads and does not invent 100', () => {
    expect(leadFormQualificRate([])).toEqual({ total: 0, qualified: 0, rate: null });
  });

  it('computes qualified / total for day-7 gate', () => {
    const rows = [
      { company_name: 'A Co', ad_budget_band: '<20tr', ad_channels: 'none' },
      { company_name: 'B Co', ad_budget_band: '50-100', ad_channels: 'google' },
      { company_name: '', ad_budget_band: '20-50', ad_channels: 'meta' },
    ];
    expect(leadFormQualificRate(rows)).toEqual({ total: 3, qualified: 2, rate: 2 / 3 });
  });
});

import {
  buildSyncStateFromErrors,
  chunkDateRange,
  formatGraphError,
  graphBreakdownsParam,
  normalizeAdAccountDigits,
  normalizeGraphInsightRow,
  parseLeadsFromActions,
  resolveSyncLastError,
} from './portal-meta-insights.util';

describe('portal-meta-insights.util', () => {
  it('normalizeAdAccountDigits strips act_', () => {
    expect(normalizeAdAccountDigits('act_2851562731715962')).toBe('2851562731715962');
    expect(normalizeAdAccountDigits('2851562731715962')).toBe('2851562731715962');
  });

  it('parseLeadsFromActions sums lead action types', () => {
    const n = parseLeadsFromActions([
      { action_type: 'lead', value: '2' },
      { action_type: 'offsite_conversion.fb_pixel_lead', value: '1' },
      { action_type: 'link_click', value: '9' },
    ]);
    expect(n).toBe(3);
  });

  it('normalizeGraphInsightRow campaign level blanks ad ids', () => {
    const row = normalizeGraphInsightRow(
      {
        campaign_id: '1',
        campaign_name: 'C',
        date_start: '2026-01-02',
        spend: '10',
        impressions: '100',
        clicks: '5',
      },
      'campaign',
    );
    expect(row?.external_adset_id).toBe('');
    expect(row?.external_ad_id).toBe('');
    expect(row?.spend).toBe(10);
  });

  it('chunkDateRange splits windows', () => {
    const chunks = chunkDateRange('2026-01-01', '2026-02-15', 30);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].since).toBe('2026-01-01');
  });

  it('resolveSyncLastError ignores breakdown-only errors', () => {
    const breakdown = ['platform_position: (#100) invalid breakdown | code=100'];
    expect(resolveSyncLastError(null, breakdown)).toBeNull();
    expect(buildSyncStateFromErrors(null, breakdown).last_error).toBeNull();
    expect(buildSyncStateFromErrors(null, breakdown).last_breakdown_warnings).toContain('platform_position');
    expect(buildSyncStateFromErrors('account insights failed', breakdown).last_error).toBe('account insights failed');
    expect(buildSyncStateFromErrors('account insights failed', breakdown).last_breakdown_warnings).toBeNull();
  });

  it('graphBreakdownsParam pairs platform_position with publisher_platform', () => {
    expect(graphBreakdownsParam('age')).toBe('age');
    expect(graphBreakdownsParam('platform_position')).toBe('publisher_platform,platform_position');
  });

  it('formatGraphError includes code and fbtrace_id', () => {
    const s = formatGraphError({
      error: { message: 'oops', code: 100, error_subcode: 33, type: 'OAuthException', fbtrace_id: 'abc' },
    });
    expect(s).toContain('oops');
    expect(s).toContain('code=100');
    expect(s).toContain('fbtrace_id=abc');
  });
});

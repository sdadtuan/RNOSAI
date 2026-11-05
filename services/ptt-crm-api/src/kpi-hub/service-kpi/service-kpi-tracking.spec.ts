import { aggregateTrackingSummary } from './service-kpi-tracking';

describe('aggregateTrackingSummary', () => {
  it('counts today actuals by period_end and splits API vs manual', () => {
    const summary = aggregateTrackingSummary({
      today: '2026-10-07',
      staleCount: 1,
      duplicateCount: 2,
      actuals: [
        {
          id: '1',
          instance_id: 'a',
          period_end: '2026-10-07',
          quality_status: 'valid',
          collection_method: 'api',
          source_ref: 'Meta Ads + CRM',
        },
        {
          id: '2',
          instance_id: 'b',
          period_end: '2026-10-06',
          quality_status: 'pending_validation',
          collection_method: 'import',
          source_ref: 'csv',
        },
        {
          id: '3',
          instance_id: 'c',
          period_end: '2026-10-07',
          quality_status: 'valid',
          collection_method: 'manual',
          source_ref: 'manual',
        },
      ],
    });

    expect(summary.today_total).toBe(2);
    expect(summary.api_connector_total).toBe(1);
    expect(summary.manual_import_total).toBe(2);
    expect(summary.pending_verify).toBe(1);
    expect(summary.data_issues).toBe(4);
  });
});

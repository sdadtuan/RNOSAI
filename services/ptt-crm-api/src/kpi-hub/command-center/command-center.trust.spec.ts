import { buildApprovalQueue, buildDataTrust } from './command-center.trust';

describe('buildDataTrust', () => {
  it('maps quality overview to trust score and sources', () => {
    const trust = buildDataTrust({
      score: 88,
      freshness: [
        { system: 'CRM', status: 'FRESH', last_success_at: '2026-09-04T08:00:00+07:00' },
        { system: 'META_ADS', status: 'DELAYED', last_success_at: null },
      ],
    });
    expect(trust.score).toBe(88);
    expect(trust.sources.find((s) => s.system === 'CRM')?.status).toBe('FRESH');
    expect(trust.sources.find((s) => s.system === 'ERP')?.status).toBe('UNKNOWN');
  });

  it('includes GA4 for marketing persona', () => {
    const trust = buildDataTrust(
      { score: 90, freshness: [] },
      { includeGa4: true },
    );
    expect(trust.sources.some((s) => s.system === 'GA4')).toBe(true);
  });
});

describe('buildApprovalQueue', () => {
  it('counts pending approvals and need-review mapping gaps', () => {
    const queue = buildApprovalQueue({
      dictionary: [
        { id: '1', code: 'MKT_001', name: 'Raw Leads', status: 'PENDING_APPROVAL' },
        { id: '2', code: 'OPS_002', name: 'Contact Rate', status: 'NEED_REVIEW', tech_preview: null },
      ],
      targets: [{ id: 't1', status: 'PENDING_APPROVAL', dictionary_code: 'MKT_002' }],
      reports: [{ id: 'r1', status: 'PENDING_APPROVAL', name: 'Weekly' }],
    });
    expect(queue.kpi_count).toBe(1);
    expect(queue.target_count).toBe(1);
    expect(queue.mapping_count).toBe(1);
    expect(queue.recent.length).toBeLessThanOrEqual(3);
  });
});

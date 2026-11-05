import {
  computeClosedLoopCpl,
  mapClosedLoopRow,
  parseReProjectIdFromTags,
} from './cp-reports-closed-loop.util';

describe('cp-reports-closed-loop.util', () => {
  it('parses re_project tag from CP project tags', () => {
    expect(parseReProjectIdFromTags(['re_project:42', 're-code:TP1'])).toBe(42);
    expect(parseReProjectIdFromTags([])).toBeNull();
  });

  it('computes CPL only when leads > 0', () => {
    expect(computeClosedLoopCpl(1_000_000, 10)).toBe(100_000);
    expect(computeClosedLoopCpl(1_000_000, 0)).toBeNull();
    expect(computeClosedLoopCpl(null, 5)).toBeNull();
  });

  it('maps closed-loop rows with ingest source metadata', () => {
    expect(mapClosedLoopRow({
      re_project_id: 7,
      re_project_name: 'The Peak',
      cp_project_id: 'p1',
      cp_project_name: 'The Peak · Creative Pack',
      spend: 2_500_000,
      valid_leads: 25,
      synced_at: '2026-09-10T08:00:00.000Z',
    })).toEqual(expect.objectContaining({
      re_project_id: 7,
      cpl: 100_000,
      source: 'ads_ops+crm_leads',
      freshness: '2026-09-10T08:00:00.000Z',
    }));
  });
});

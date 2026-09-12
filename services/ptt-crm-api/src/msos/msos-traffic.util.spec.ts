import { evaluateTraffic } from './msos-traffic.util';

describe('msos-traffic.util', () => {
  const base = {
    creativeId: 'c1',
    width: 300,
    height: 250,
    weightKb: 100,
    maxWeightKb: 200,
    clickUrl: 'https://example.com/landing',
    backupRequired: false,
    backupAttached: false,
    status: 'approved_by_partner' as const,
  };

  it('ready when all requirements met', () => {
    const out = evaluateTraffic(base);
    expect(out.ready).toBe(true);
    expect(out.reasons).toEqual([]);
  });

  it('not ready when draft status', () => {
    const out = evaluateTraffic({ ...base, status: 'draft' });
    expect(out.ready).toBe(false);
    expect(out.reasons).toContain('status_not_approved');
  });

  it('not ready when click url not https', () => {
    const out = evaluateTraffic({ ...base, clickUrl: 'http://insecure.com' });
    expect(out.ready).toBe(false);
    expect(out.reasons).toContain('click_url_not_https');
  });

  it('not ready when creative missing', () => {
    const out = evaluateTraffic({ ...base, creativeId: null });
    expect(out.ready).toBe(false);
    expect(out.reasons).toContain('creative_required');
  });

  it('not ready when size missing', () => {
    const out = evaluateTraffic({ ...base, width: null });
    expect(out.ready).toBe(false);
    expect(out.reasons).toContain('size_required');
  });

  it('not ready when weight exceeds max', () => {
    const out = evaluateTraffic({ ...base, weightKb: 300, maxWeightKb: 200 });
    expect(out.ready).toBe(false);
    expect(out.reasons).toContain('weight_exceeds_max');
  });

  it('not ready when backup required but missing', () => {
    const out = evaluateTraffic({ ...base, backupRequired: true, backupAttached: false });
    expect(out.ready).toBe(false);
    expect(out.reasons).toContain('backup_required');
  });
});

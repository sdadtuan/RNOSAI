import { canClosePeriod, canPublishClientReport, cascadeQuality } from './performance-quality';

describe('performance-quality', () => {
  it('stale Valid Lead cascades to CPL and MQL Rate and blocks close (AC-PM-04)', () => {
    const out = cascadeQuality([
      { kpi: 'Valid Lead', quality: 'stale', dependents: ['CPL Valid Lead', 'MQL Rate'] },
      { kpi: 'CPL Valid Lead', quality: 'verified', dependents: [] },
      { kpi: 'MQL Rate', quality: 'verified', dependents: [] },
      { kpi: 'CPA Meta', quality: 'verified', dependents: [] },
    ]);
    expect(out.find((x) => x.kpi === 'CPL Valid Lead')?.quality).toBe('pending');
    expect(out.find((x) => x.kpi === 'MQL Rate')?.quality).toBe('pending');
    expect(out.find((x) => x.kpi === 'CPA Meta')?.quality).toBe('verified');
    expect(canClosePeriod(out)).toBe(false);
  });

  it('does not upgrade stale dependents to verified', () => {
    const out = cascadeQuality([
      { kpi: 'Valid Lead', quality: 'pending', dependents: ['CPL Valid Lead'] },
      { kpi: 'CPL Valid Lead', quality: 'stale', dependents: [] },
    ]);
    expect(out.find((x) => x.kpi === 'CPL Valid Lead')?.quality).toBe('stale');
  });

  it('client report requires verified + client_visible', () => {
    expect(canPublishClientReport({ quality: 'pending', client_visible: true })).toBe(false);
    expect(canPublishClientReport({ quality: 'verified', client_visible: false })).toBe(false);
    expect(canPublishClientReport({ quality: 'verified', client_visible: true })).toBe(true);
  });
});

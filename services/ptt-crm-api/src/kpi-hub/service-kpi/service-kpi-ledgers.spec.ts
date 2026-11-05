import { canPublishClientReport } from './service-kpi-ledgers';

describe('canPublishClientReport', () => {
  it('blocks Reported from pending_validation (AC-SKPI-07)', () => {
    expect(canPublishClientReport('pending_validation', true)).toBe(false);
    expect(canPublishClientReport('valid', true)).toBe(true);
    expect(canPublishClientReport('valid', false)).toBe(false);
  });
});

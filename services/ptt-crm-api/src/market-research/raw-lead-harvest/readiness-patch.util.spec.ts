import { assertManualReadyAllowed, isRawLeadReadinessStatus } from './readiness-patch.util';

describe('readiness-patch.util', () => {
  it('validates status strings', () => {
    expect(isRawLeadReadinessStatus('READY_TO_PUSH')).toBe(true);
    expect(isRawLeadReadinessStatus('bogus')).toBe(false);
  });

  it('blocks READY when BLACKLIST reason without force', () => {
    expect(
      assertManualReadyAllowed({
        next: 'READY_TO_PUSH',
        current_reason_codes: ['BLACKLIST'],
      }),
    ).toEqual({ ok: false, error: 'cannot_ready_blacklist_or_dnc' });
  });

  it('allows READY with force_ready', () => {
    expect(
      assertManualReadyAllowed({
        next: 'READY_TO_PUSH',
        current_reason_codes: ['BLACKLIST'],
        force_ready: true,
      }),
    ).toEqual({ ok: true });
  });
});

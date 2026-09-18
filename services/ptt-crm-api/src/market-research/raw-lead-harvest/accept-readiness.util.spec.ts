import { readinessAfterAccept } from './accept-readiness.util';

describe('readinessAfterAccept', () => {
  it('promotes NEEDS_REVIEW to READY_TO_PUSH', () => {
    expect(readinessAfterAccept({ readiness_status: 'NEEDS_REVIEW' })).toEqual({
      promote: true,
      readiness_status: 'READY_TO_PUSH',
      readiness_reason_codes: ['STAFF_ACCEPTED'],
      classification: 'pass',
    });
  });

  it('does not change READY_TO_PUSH', () => {
    expect(readinessAfterAccept({ readiness_status: 'READY_TO_PUSH' })).toEqual({
      promote: false,
    });
  });

  it('does not promote MISSING_CONTACT or DUPLICATE', () => {
    expect(readinessAfterAccept({ readiness_status: 'MISSING_CONTACT' })).toEqual({
      promote: false,
    });
    expect(
      readinessAfterAccept({ readiness_status: 'DUPLICATE_OR_BLACKLIST' }),
    ).toEqual({ promote: false });
  });

  it('legacy contactable → READY', () => {
    expect(readinessAfterAccept({ readiness_status: null, contactable: true })).toEqual({
      promote: true,
      readiness_status: 'READY_TO_PUSH',
      readiness_reason_codes: ['STAFF_ACCEPTED'],
      classification: 'pass',
    });
  });

  it('legacy non-contactable → NEEDS_REVIEW', () => {
    expect(readinessAfterAccept({ readiness_status: null, contactable: false })).toEqual({
      promote: true,
      readiness_status: 'NEEDS_REVIEW',
      readiness_reason_codes: ['STAFF_ACCEPTED_NEEDS_CONTACT'],
      classification: 'needs_review',
    });
  });
});

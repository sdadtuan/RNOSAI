import {
  buildAccountClusterKey,
  computePriorityTier,
  extractRegistrableDomain,
} from './priority-cluster.util';

describe('priority-cluster.util', () => {
  it('prefers place_id for cluster key', () => {
    expect(
      buildAccountClusterKey({
        id: 1,
        place_id: 'abc',
        phone_norm: '0909479018',
        company_name: 'Spa',
      }),
    ).toBe('place:abc');
  });

  it('falls back phone → domain → name → id', () => {
    expect(
      buildAccountClusterKey({ id: 2, phone_norm: '0909479018', company_name: 'Spa' }),
    ).toBe('phone:0909479018');
    expect(
      buildAccountClusterKey({
        id: 3,
        website: 'https://www.spa.example',
        company_name: 'Spa Hoa',
      }),
    ).toBe('domain:spa.example');
    expect(buildAccountClusterKey({ id: 4, company_name: 'Spa Hoa Mi' })).toBe(
      `name:${'spahoami'}`,
    );
    expect(buildAccountClusterKey({ id: 9, company_name: 'ab' })).toBe('id:9');
  });

  it('ignores social hosts as domain', () => {
    expect(extractRegistrableDomain('https://facebook.com/spa')).toBeNull();
  });

  it('assigns P1/P2/P3 by readiness and score', () => {
    expect(
      computePriorityTier({
        readiness_status: 'READY_TO_PUSH',
        quality_score: 55,
        contactable: true,
        phone_norm: '0909479018',
      }),
    ).toBe('P1');
    expect(
      computePriorityTier({
        readiness_status: 'READY_TO_PUSH',
        quality_score: 40,
        contactable: true,
        phone_norm: '0909479018',
      }),
    ).toBe('P2');
    expect(
      computePriorityTier({
        readiness_status: 'NEEDS_REVIEW',
        quality_score: 40,
        phone_norm: '0909479018',
      }),
    ).toBe('P2');
    expect(
      computePriorityTier({
        readiness_status: 'MISSING_CONTACT',
        quality_score: 20,
      }),
    ).toBe('P3');
  });
});

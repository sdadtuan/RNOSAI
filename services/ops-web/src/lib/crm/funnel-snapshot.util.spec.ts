import { describe, expect, it } from 'vitest';
import {
  effectiveAssignedAmId,
  funnelB2Complete,
  funnelAssignedAmId,
  funnelPresalesStage,
  funnelServiceSlug,
  normalizeAgencyClientId,
} from './funnel-snapshot.util';

describe('funnel-snapshot.util', () => {
  it('funnelB2Complete does not throw when care_pipeline is missing', () => {
    expect(funnelB2Complete(null)).toBe(false);
    expect(funnelB2Complete({} as never)).toBe(false);
    expect(funnelB2Complete({ care_pipeline: { all_complete: true } } as never)).toBe(true);
  });

  it('funnelPresalesStage uses nested optional presales', () => {
    expect(funnelPresalesStage(null)).toBeNull();
    expect(funnelPresalesStage({ presales: {} } as never)).toBeNull();
    expect(
      funnelPresalesStage({ presales: { presales: { stage: 'lead' } } } as never),
    ).toBe('lead');
  });

  it('funnelServiceSlug reads nested service_slug', () => {
    expect(funnelServiceSlug({ presales: { presales: { service_slug: 'seo' } } } as never)).toBe(
      'seo',
    );
  });

  it('normalizeAgencyClientId coerces non-string values', () => {
    expect(normalizeAgencyClientId(undefined)).toBeNull();
    expect(normalizeAgencyClientId(42)).toBe('42');
    expect(normalizeAgencyClientId('  uuid  ')).toBe('uuid');
  });

  it('funnelAssignedAmId reads nested presales.assigned_am', () => {
    expect(funnelAssignedAmId(null)).toBeNull();
    expect(
      funnelAssignedAmId({ presales: { presales: { assigned_am: 108 } } } as never),
    ).toBe(108);
    expect(funnelAssignedAmId({ presales: { assigned_am: 107 } } as never)).toBe(107);
  });

  it('funnelAssignedAmId is empty when assigned_am equals the Sales owner', () => {
    expect(funnelAssignedAmId({ presales: { assigned_am: 7 } } as never, 7)).toBeNull();
    expect(funnelAssignedAmId({ presales: { assigned_am: 21 } } as never, 7)).toBe(21);
  });

  it('effectiveAssignedAmId hides a Sales owner used as AM', () => {
    expect(effectiveAssignedAmId(null, 7)).toBeNull();
    expect(effectiveAssignedAmId(7, 7)).toBeNull();
    expect(effectiveAssignedAmId(21, 7)).toBe(21);
  });
});

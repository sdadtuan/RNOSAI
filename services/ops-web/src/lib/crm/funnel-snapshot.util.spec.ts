import { describe, expect, it } from 'vitest';
import {
  funnelB2Complete,
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
});

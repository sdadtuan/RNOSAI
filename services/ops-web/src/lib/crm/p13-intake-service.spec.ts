import { describe, expect, it } from 'vitest';
import { p13CodeForIntakeService, p13CodeForIntakeSlug } from './p13-intake-service';

const services = [{ code: 'SEO' }, { code: 'WEB' }, { code: 'ADS' }];

describe('p13CodeForIntakeSlug', () => {
  it('maps an intake slug onto the P13 service', () => {
    expect(p13CodeForIntakeSlug('dich-vu-seo-tong-the', services)).toBe('SEO');
    expect(p13CodeForIntakeSlug('thiet-ke-website', services)).toBe('WEB');
  });

  it('accepts a P13 code typed as the slug', () => {
    expect(p13CodeForIntakeSlug('ads', services)).toBe('ADS');
  });

  it('matches a catalog label to the P13 service name', () => {
    expect(
      p13CodeForIntakeService(
        { slug: 'toi-uu-seo-aeo', label: 'Tối ưu SEO & AEO' },
        [{ code: 'SEO', name: 'Tối ưu SEO & AEO' }],
      ),
    ).toBe('SEO');
  });

  it('returns null when nothing is selected', () => {
    expect(p13CodeForIntakeSlug('_common', services)).toBeNull();
    expect(p13CodeForIntakeSlug('khong-co', services)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { CMKTE_TABS, nextTabLabel } from './cmkte-tabs';

describe('CMKTE_TABS', () => {
  it('locks 8 workspace tab labels from the mockup contract', () => {
    expect(CMKTE_TABS).toHaveLength(8);
    expect(CMKTE_TABS.map((tab) => tab.id)).toEqual([
      'brief',
      'architecture',
      'copy',
      'assets',
      'seo',
      'production',
      'approvaltab',
      'publish',
    ]);
    expect(CMKTE_TABS.map((tab) => tab.label)).toEqual([
      '1. Brief & Strategy',
      '2. Content Architecture',
      '3. Copy Studio',
      '4. Assets, DAM & Rights',
      '5. SEO & Distribution',
      '6. Production Plan',
      '7. Approval & Governance',
      '8. Publish Control',
    ]);
  });
});

describe('nextTabLabel', () => {
  it('returns mockup next labels and Send to approval on the last tab', () => {
    expect(nextTabLabel('brief')).toBe('Content Architecture');
    expect(nextTabLabel('architecture')).toBe('Copy Studio');
    expect(nextTabLabel('copy')).toBe('Assets, DAM & Rights');
    expect(nextTabLabel('assets')).toBe('SEO & Distribution');
    expect(nextTabLabel('seo')).toBe('Production Plan');
    expect(nextTabLabel('production')).toBe('Approval & Governance');
    expect(nextTabLabel('approvaltab')).toBe('Publish Control');
    expect(nextTabLabel('publish')).toBe('Send to approval');
  });
});

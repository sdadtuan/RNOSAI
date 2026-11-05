import { describe, expect, it } from 'vitest';
import {
  contentMarketingPilotSlugs,
  isContentMarketingFeEnabled,
  isContentOsLifecycleEligible,
} from '@/lib/content-marketing-flags';

function restoreEnv(key: string, prev: string | undefined) {
  if (prev === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = prev;
  }
}

describe('content-marketing-flags', () => {
  it('isContentMarketingFeEnabled reads NEXT_PUBLIC_CONTENT_MARKETING', () => {
    const prev = process.env.NEXT_PUBLIC_CONTENT_MARKETING;
    try {
      process.env.NEXT_PUBLIC_CONTENT_MARKETING = '1';
      expect(isContentMarketingFeEnabled()).toBe(true);
      process.env.NEXT_PUBLIC_CONTENT_MARKETING = '0';
      expect(isContentMarketingFeEnabled()).toBe(false);
    } finally {
      restoreEnv('NEXT_PUBLIC_CONTENT_MARKETING', prev);
    }
  });

  it('contentMarketingPilotSlugs splits comma list', () => {
    const prev = process.env.NEXT_PUBLIC_CONTENT_MARKETING_SLUGS;
    try {
      process.env.NEXT_PUBLIC_CONTENT_MARKETING_SLUGS = 'tiep-thi-noi-dung, seo-retainer';
      expect(contentMarketingPilotSlugs()).toEqual(['tiep-thi-noi-dung', 'seo-retainer']);
    } finally {
      restoreEnv('NEXT_PUBLIC_CONTENT_MARKETING_SLUGS', prev);
    }
  });

  it('isContentOsLifecycleEligible allows all when allowlist empty', () => {
    expect(isContentOsLifecycleEligible('ads-retainer', [])).toBe(true);
  });

  it('isContentOsLifecycleEligible filters when allowlist set', () => {
    expect(isContentOsLifecycleEligible('tiep-thi-noi-dung', ['tiep-thi-noi-dung'])).toBe(true);
    expect(isContentOsLifecycleEligible('ads-retainer', ['tiep-thi-noi-dung'])).toBe(false);
  });
});

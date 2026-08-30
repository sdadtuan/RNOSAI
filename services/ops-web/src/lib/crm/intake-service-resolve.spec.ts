import { describe, expect, it } from 'vitest';
import {
  gapToConsultLabel,
  gapToGo,
  intakeServiceLabel,
  resolveIntakeServiceSlug,
  shouldSyncDraftServiceSlug,
} from './intake-service-resolve';

describe('resolveIntakeServiceSlug', () => {
  it('prefers URL slug when in catalog', () => {
    expect(
      resolveIntakeServiceSlug({
        urlSlug: 'quang-cao-google',
        sessionSlug: 'dich-vu-seo-tong-the',
        funnelSlug: 'thiet-ke-website',
      }),
    ).toBe('quang-cao-google');
  });

  it('url slug wins over funnel', () => {
    expect(
      resolveIntakeServiceSlug({
        urlSlug: 'quang-cao-google',
        funnelSlug: 'thiet-ke-website',
      }),
    ).toBe('quang-cao-google');
  });

  it('skips session _common and uses funnel', () => {
    expect(
      resolveIntakeServiceSlug({
        urlSlug: '',
        sessionSlug: '_common',
        funnelSlug: 'dich-vu-seo-tong-the',
      }),
    ).toBe('dich-vu-seo-tong-the');
  });

  it('falls back to _common', () => {
    expect(resolveIntakeServiceSlug({})).toBe('_common');
  });

  it('rejects unknown url slug', () => {
    expect(
      resolveIntakeServiceSlug({ urlSlug: 'not-a-service', funnelSlug: 'dich-vu-aeo' }),
    ).toBe('dich-vu-aeo');
  });
});

describe('gapToGo', () => {
  it('returns remaining points under 24', () => {
    expect(gapToGo(8)).toBe(16);
    expect(gapToGo(24)).toBe(0);
    expect(gapToGo(30)).toBe(0);
  });
});

describe('gapToConsultLabel', () => {
  it('uses Tư vấn not Go', () => {
    expect(gapToConsultLabel(0)).toBe('Đủ Tư vấn');
    expect(gapToConsultLabel(16)).toBe('Còn 16 để Tư vấn');
    expect(gapToConsultLabel(gapToGo(8))).toBe('Còn 16 để Tư vấn');
  });
});

describe('shouldSyncDraftServiceSlug', () => {
  it('syncs draft _common to resolved pilot', () => {
    expect(
      shouldSyncDraftServiceSlug({
        status: 'draft',
        sessionSlug: '_common',
        resolvedSlug: 'dich-vu-seo-tong-the',
      }),
    ).toBe(true);
  });

  it('does not sync completed or already-matching slugs', () => {
    expect(
      shouldSyncDraftServiceSlug({
        status: 'completed',
        sessionSlug: '_common',
        resolvedSlug: 'dich-vu-seo-tong-the',
      }),
    ).toBe(false);
    expect(
      shouldSyncDraftServiceSlug({
        status: 'draft',
        sessionSlug: 'dich-vu-seo-tong-the',
        resolvedSlug: 'dich-vu-seo-tong-the',
      }),
    ).toBe(false);
    expect(
      shouldSyncDraftServiceSlug({
        status: 'draft',
        sessionSlug: '_common',
        resolvedSlug: '_common',
      }),
    ).toBe(false);
  });
});

describe('intakeServiceLabel', () => {
  it('labels three pilots and common', () => {
    expect(intakeServiceLabel('dich-vu-seo-tong-the')).toBe('SEO tổng thể');
    expect(intakeServiceLabel('quang-cao-google')).toBe('Quảng cáo Google');
    expect(intakeServiceLabel('thiet-ke-website')).toBe('Thiết kế website');
    expect(intakeServiceLabel('_common')).toBe('Chưa chọn dịch vụ');
  });

  it('labels dich-vu-aeo as AEO', () => {
    expect(intakeServiceLabel('dich-vu-aeo')).toBe('AEO');
  });
});

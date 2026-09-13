import { describe, expect, it } from 'vitest';
import { isCpImageSopVisible, OFF_CP_IMAGE_FLAGS } from './cp-image-sop.flags';

describe('cp-image-sop.flags', () => {
  it('defaults off when flag disabled', () => {
    expect(OFF_CP_IMAGE_FLAGS.enabled).toBe(false);
  });

  it('hides when flag off even with cap', () => {
    expect(isCpImageSopVisible(OFF_CP_IMAGE_FLAGS, true)).toBe(false);
  });

  it('shows when flag on and cap present', () => {
    expect(isCpImageSopVisible({ enabled: true, router: 'manual' }, true)).toBe(true);
  });

  it('hides when cap missing', () => {
    expect(isCpImageSopVisible({ enabled: true, router: 'recommended' }, false)).toBe(false);
  });
});

import { readImageSopFlags } from './cp-image-sop.flags';

describe('readImageSopFlags', () => {
  it('defaults CP_IMAGE_SOP_ENABLED off', () => {
    expect(readImageSopFlags({}).enabled).toBe(false);
  });

  it('enables on 1 or true', () => {
    expect(readImageSopFlags({ CP_IMAGE_SOP_ENABLED: '1' }).enabled).toBe(true);
    expect(readImageSopFlags({ CP_IMAGE_SOP_ENABLED: 'true' }).enabled).toBe(true);
  });

  it('defaults router to manual', () => {
    expect(readImageSopFlags({}).router).toBe('manual');
  });

  it('parses variant and batch max', () => {
    const flags = readImageSopFlags({
      CP_IMAGE_SOP_VARIANT_MAX: '4',
      CP_IMAGE_SOP_BATCH_MAX: '30',
    });
    expect(flags.variantMax).toBe(4);
    expect(flags.batchMax).toBe(30);
  });
});

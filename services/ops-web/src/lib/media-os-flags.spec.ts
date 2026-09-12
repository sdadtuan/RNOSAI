import { describe, expect, it, afterEach } from 'vitest';
import { isMediaOsFeEnabled } from './media-os-flags';

describe('isMediaOsFeEnabled', () => {
  const prev = process.env.NEXT_PUBLIC_MEDIA_OS;
  afterEach(() => {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_MEDIA_OS;
    else process.env.NEXT_PUBLIC_MEDIA_OS = prev;
  });
  it('is off by default', () => {
    delete process.env.NEXT_PUBLIC_MEDIA_OS;
    expect(isMediaOsFeEnabled()).toBe(false);
  });
});

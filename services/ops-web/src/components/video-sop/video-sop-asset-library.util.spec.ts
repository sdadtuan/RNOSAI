import { describe, expect, it } from 'vitest';
import {
  resolveLibraryLifecycleId,
  formatAssetSha8,
  formatAssetSize,
} from './video-sop-asset-library.util';

describe('video-sop-asset-library.util', () => {
  it('prefers query lifecycle over project lifecycle', () => {
    expect(resolveLibraryLifecycleId(4, 9)).toBe(4);
    expect(resolveLibraryLifecycleId(undefined, 9)).toBe(9);
    expect(resolveLibraryLifecycleId(undefined, undefined)).toBeUndefined();
  });

  it('formats sha and size', () => {
    expect(formatAssetSha8('abcdefghij')).toBe('abcdefgh');
    expect(formatAssetSha8(null)).toBe('—');
    expect(formatAssetSize(1080, 1920)).toBe('1080×1920');
    expect(formatAssetSize(null, null)).toBe('—');
  });
});

import { describe, expect, it } from 'vitest';
import { API_BASE, playableAssetSrc } from './api';

describe('playableAssetSrc', () => {
  it('keeps absolute http URLs and prefixes same-origin signed paths', () => {
    expect(playableAssetSrc('https://cdn.example/a.mp4')).toBe('https://cdn.example/a.mp4');
    expect(playableAssetSrc('/api/v1/creatives/x/asset?exp=1&sig=a')).toBe(
      `${API_BASE}/api/v1/creatives/x/asset?exp=1&sig=a`,
    );
  });
});

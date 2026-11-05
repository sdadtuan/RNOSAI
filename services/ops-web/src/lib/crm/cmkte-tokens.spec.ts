import { describe, expect, it } from 'vitest';
import { CMKTE_TOKENS } from './cmkte-tokens';

describe('CMKTE_TOKENS', () => {
  it('locks mockup v2 chrome', () => {
    expect(CMKTE_TOKENS.nav).toBe('#101a30');
    expect(CMKTE_TOKENS.nav2).toBe('#172642');
    expect(CMKTE_TOKENS.ink).toBe('#15213a');
    expect(CMKTE_TOKENS.bg).toBe('#f4f6fa');
    expect(CMKTE_TOKENS.blue).toBe('#3268f6');
    expect(CMKTE_TOKENS.purple).toBe('#7656e9');
    expect(CMKTE_TOKENS.green).toBe('#139567');
    expect(CMKTE_TOKENS.amber).toBe('#d88400');
    expect(CMKTE_TOKENS.red).toBe('#d84951');
    expect(CMKTE_TOKENS.sidebarPx).toBe(258);
    expect(CMKTE_TOKENS.topPx).toBe(67);
    expect(CMKTE_TOKENS.stickyPx).toBe(66);
    expect(CMKTE_TOKENS.rightPanelPx).toBe(345);
  });
});

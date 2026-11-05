import { parseMediaOsFlag } from './msos-flags.util';

describe('msos flags', () => {
  it('defaults off on undefined/empty', () => {
    expect(parseMediaOsFlag(undefined)).toBe(false);
    expect(parseMediaOsFlag('')).toBe(false);
    expect(parseMediaOsFlag('0')).toBe(false);
  });
  it('accepts 1/true/yes/on', () => {
    expect(parseMediaOsFlag('1')).toBe(true);
    expect(parseMediaOsFlag('true')).toBe(true);
  });
});

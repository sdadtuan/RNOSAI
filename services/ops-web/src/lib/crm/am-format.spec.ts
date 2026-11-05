import { describe, expect, it } from 'vitest';
import { bandCopy, dash } from './am-format';

describe('dash', () => {
  it('returns an em dash for null', () => {
    expect(dash(null)).toBe('—');
  });

  it('returns an em dash for undefined', () => {
    expect(dash(undefined)).toBe('—');
  });

  it('stringifies zero and other numbers', () => {
    expect(dash(0)).toBe('0');
    expect(dash(12)).toBe('12');
  });
});

describe('bandCopy', () => {
  it('maps watch to Cần theo dõi', () => {
    expect(bandCopy('watch')).toBe('Cần theo dõi');
  });

  it('maps remaining bands and missing values', () => {
    expect(bandCopy('healthy')).toBe('Khỏe mạnh');
    expect(bandCopy('at_risk')).toBe('Có rủi ro');
    expect(bandCopy('critical')).toBe('Nghiêm trọng');
    expect(bandCopy(null)).toBe('—');
    expect(bandCopy(undefined)).toBe('—');
  });
});

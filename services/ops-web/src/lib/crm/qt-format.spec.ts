import { describe, expect, it } from 'vitest';
import { dash } from './qt-format';

describe('dash', () => {
  it('renders null as an em dash', () => {
    expect(dash(null)).toBe('—');
  });

  it('renders empty values as an em dash', () => {
    expect(dash(undefined)).toBe('—');
    expect(dash('')).toBe('—');
  });

  it('preserves zero', () => {
    expect(dash(0)).toBe('0');
  });
});

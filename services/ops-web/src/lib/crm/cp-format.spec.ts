import { describe, expect, it } from 'vitest';
import { dash } from './cp-format';

describe('dash', () => {
  it('renders nullish values as an em dash', () => {
    expect(dash(null)).toBe('—');
  });

  it('preserves zero', () => {
    expect(dash(0)).toBe('0');
  });
});

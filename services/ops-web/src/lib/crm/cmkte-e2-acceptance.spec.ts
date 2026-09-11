import { describe, expect, it } from 'vitest';
import { pctLabel } from './cmkte-workspace';

describe('E2 Command Center capacity label', () => {
  it('renders an em dash when capacity_pct is null and never a fake 78%', () => {
    const label = pctLabel(null);
    expect(label).toBe('—');
    expect(label).not.toContain('78');
    expect(label).not.toMatch(/\d/);
  });

  it('renders a real percent only when capacity_pct is a number', () => {
    expect(pctLabel(50)).toBe('50%');
    expect(pctLabel(0)).toBe('0%');
  });
});

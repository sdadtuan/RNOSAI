import { describe, expect, it } from 'vitest';
import { attainmentTag, formatRevopsPct, formatRevopsVnd } from './revops-format';

describe('revops-format', () => {
  it('formatRevopsVnd null', () => {
    expect(formatRevopsVnd(null)).toBe('—');
  });

  it('formatRevopsVnd formats vi-VN', () => {
    expect(formatRevopsVnd(1_245_000_000)).toContain('đ');
    expect(formatRevopsVnd(1_245_000_000)).toMatch(/1[.\s]245/);
  });

  it('formatRevopsPct', () => {
    expect(formatRevopsPct(null)).toBe('—');
    expect(formatRevopsPct(92.4)).toBe('92%');
  });

  it('attainmentTag thresholds', () => {
    expect(attainmentTag(null)).toBe('—');
    expect(attainmentTag(115)).toBe('Accelerator');
    expect(attainmentTag(93)).toBe('On track');
    expect(attainmentTag(75)).toBe('Need attention');
    expect(attainmentTag(50)).toBe('At risk');
  });
});

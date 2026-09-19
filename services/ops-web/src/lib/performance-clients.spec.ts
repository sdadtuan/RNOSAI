import { describe, expect, it } from 'vitest';
import { matchesClientFilter, matchesTextFilter } from './performance-clients';

describe('performance-clients filters', () => {
  it('matches client filter case-insensitively', () => {
    expect(matchesClientFilter('360 AUTO DETAILING', '360')).toBe(true);
    expect(matchesClientFilter('Spa ABC', '360')).toBe(false);
    expect(matchesClientFilter('Spa ABC', 'all')).toBe(true);
  });

  it('matches free-text across fields', () => {
    expect(matchesTextFilter(['Growth Launch', 'An Phát', 'QT-0089'], 'an phát')).toBe(true);
    expect(matchesTextFilter(['Growth Launch', 'An Phát'], 'edu')).toBe(false);
    expect(matchesTextFilter(['x'], '')).toBe(true);
  });
});

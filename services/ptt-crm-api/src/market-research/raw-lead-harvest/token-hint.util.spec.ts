import { researchAiTokenHint } from './token-hint.util';

describe('researchAiTokenHint', () => {
  it('returns last 4 chars with ellipsis', () => {
    expect(researchAiTokenHint('sk-live-abcdef')).toBe('…cdef');
  });

  it('handles short secrets', () => {
    expect(researchAiTokenHint('ab')).toBe('…ab');
  });

  it('handles empty', () => {
    expect(researchAiTokenHint('')).toBe('…');
  });
});

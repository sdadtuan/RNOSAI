import { describe, expect, it } from 'vitest';
import { amRecoveryRequiredCopy } from './am-risk.util';

describe('am-risk banner copy', () => {
  it('tells operators Critical needs an open recovery plan', () => {
    expect(amRecoveryRequiredCopy()).toMatch(/Critical/i);
    expect(amRecoveryRequiredCopy()).toMatch(/recovery/i);
  });
});

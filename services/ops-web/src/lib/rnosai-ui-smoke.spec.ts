import { describe, expect, it } from 'vitest';

describe('@rnosai/ui wiring', () => {
  it('resolves Button export', async () => {
    const mod = await import('@rnosai/ui');
    expect(typeof mod.Button).toBe('function');
  });
});

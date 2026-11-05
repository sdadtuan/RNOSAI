import { describe, expect, it } from 'vitest';
import { WORK_SIGNALS } from './work-signals';

describe('WORK_SIGNALS', () => {
  it('locks Canopy final work-signal hex', () => {
    expect(WORK_SIGNALS).toEqual({
      ptt: '#17692f',
      pttDeep: '#114d24',
      hot: '#e11d48',
      warm: '#ea580c',
      gold: '#ca8a04',
      sky: '#0284c7',
      iris: '#7c3aed',
      won: '#059669',
      cold: '#94a3b8',
    });
  });
});

import { describe, expect, it } from 'vitest';
import { MSOS_EMPTY, MSOS_UI_DENYLIST } from './msos-empty';

describe('MSOS empty copy', () => {
  it('empty copy has no demo ids', () => {
    const blob = JSON.stringify(MSOS_EMPTY);
    for (const n of MSOS_UI_DENYLIST) expect(blob).not.toContain(n);
  });
});
